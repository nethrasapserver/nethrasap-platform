"""Transactional outbox — atomicity with the caller's transaction, dispatch
bookkeeping, retry accounting, and dead-lettering after MAX_ATTEMPTS.

The arq seam is `app.worker.enqueue_job` (dispatch_pending late-imports the
worker module and calls it as an attribute, so monkeypatching the module
attribute is enough).
"""
from __future__ import annotations

from typing import Any

import pytest
from sqlalchemy import func, select

import app.worker
from app.models.outbox import JobOutbox, OutboxStatus
from app.services import outbox


async def _count(db, task_name: str) -> int:
    return (
        await db.execute(
            select(func.count()).select_from(JobOutbox).where(JobOutbox.task_name == task_name)
        )
    ).scalar_one()


async def _row(db, task_name: str) -> JobOutbox:
    return (
        await db.execute(select(JobOutbox).where(JobOutbox.task_name == task_name))
    ).scalar_one()


@pytest.mark.asyncio
async def test_rollback_leaves_no_outbox_row(db_session):
    await outbox.enqueue_via_outbox(db_session, "outbox_test_rollback", order_number="NS-1")
    await db_session.rollback()
    assert await _count(db_session, "outbox_test_rollback") == 0


@pytest.mark.asyncio
async def test_dispatch_marks_row_dispatched(db_session, monkeypatch):
    calls: list[tuple[str, dict[str, Any]]] = []

    async def fake_enqueue(name: str, *args: Any, **kwargs: Any) -> None:
        calls.append((name, kwargs))

    monkeypatch.setattr(app.worker, "enqueue_job", fake_enqueue)

    await outbox.enqueue_via_outbox(db_session, "outbox_test_ok", order_number="NS-2")
    await db_session.commit()

    assert await outbox.dispatch_pending(db_session) == 1

    row = await _row(db_session, "outbox_test_ok")
    assert row.status == OutboxStatus.dispatched
    assert row.dispatched_at is not None
    assert row.attempts == 0
    assert row.last_error is None
    assert calls == [("outbox_test_ok", {"order_number": "NS-2"})]


@pytest.mark.asyncio
async def test_enqueue_failure_bumps_attempts_row_stays_pending(db_session, monkeypatch):
    async def broken_enqueue(name: str, *args: Any, **kwargs: Any) -> None:
        raise ConnectionError("redis down")

    monkeypatch.setattr(app.worker, "enqueue_job", broken_enqueue)

    await outbox.enqueue_via_outbox(db_session, "outbox_test_retry", order_number="NS-3")
    await db_session.commit()

    assert await outbox.dispatch_pending(db_session) == 0

    row = await _row(db_session, "outbox_test_retry")
    assert row.status == OutboxStatus.pending
    assert row.attempts == 1
    assert row.dispatched_at is None
    assert "redis down" in (row.last_error or "")


@pytest.mark.asyncio
async def test_tenth_failure_dead_letters_row(db_session, monkeypatch):
    async def broken_enqueue(name: str, *args: Any, **kwargs: Any) -> None:
        raise ConnectionError("redis still down")

    monkeypatch.setattr(app.worker, "enqueue_job", broken_enqueue)

    row = await outbox.enqueue_via_outbox(db_session, "outbox_test_dead", run_id="abc")
    row.attempts = outbox.MAX_ATTEMPTS - 1  # nine prior failed sweeps
    await db_session.commit()

    assert await outbox.dispatch_pending(db_session) == 0

    row = await _row(db_session, "outbox_test_dead")
    assert row.status == OutboxStatus.failed
    assert row.attempts == outbox.MAX_ATTEMPTS
    assert await outbox.count_failed(db_session) >= 1

    # Dead-lettered rows are parked: even a healthy dispatcher skips them.
    async def fake_enqueue(name: str, *args: Any, **kwargs: Any) -> None:  # pragma: no cover
        raise AssertionError("failed row must not be re-dispatched")

    monkeypatch.setattr(app.worker, "enqueue_job", fake_enqueue)
    assert await outbox.dispatch_pending(db_session) == 0
    row = await _row(db_session, "outbox_test_dead")
    assert row.status == OutboxStatus.failed
