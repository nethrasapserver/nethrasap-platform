"""Transactional outbox — crash-safe background job enqueueing.

The old pattern (`db.commit()` then `enqueue_job(...)`) had a loss window: a
crash between the commit and the Redis enqueue dropped the job forever. Now:

1. `enqueue_via_outbox(db, name, **kwargs)` inserts a `job_outbox` row in the
   CALLER's transaction (no commit here) — the job intent commits atomically
   with the business change, or not at all.
2. Right after the caller commits, it calls `dispatch_pending(db)` for
   immediate best-effort delivery to arq.
3. The worker's `dispatch_outbox` cron sweep (see app/worker.py) retries any
   row still `pending` — the crash-recovery path.

Rows failing `MAX_ATTEMPTS` dispatches park as `failed` (dead-letter) and are
never retried automatically; the sweep logs a WARNING while any exist.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..logging import get_logger
from ..models.outbox import JobOutbox, OutboxStatus

log = get_logger("services.outbox")

MAX_ATTEMPTS = 10
DISPATCH_BATCH = 20


async def enqueue_via_outbox(db: AsyncSession, task_name: str, **kwargs: Any) -> JobOutbox:
    """Record a job in the caller's open transaction. Does NOT commit — the
    row becomes visible (and dispatchable) only when the caller commits."""
    row = JobOutbox(task_name=task_name, payload=kwargs)
    db.add(row)
    await db.flush()
    return row


async def dispatch_pending(db: AsyncSession) -> int:
    """Push committed `pending` rows onto arq; returns how many dispatched.

    Best-effort by design: per-row enqueue failures bump `attempts` and are
    retried by the worker sweep (or parked as `failed` after MAX_ATTEMPTS);
    unexpected errors are logged, never raised — callers run this right after
    their commit and must not fail the request over a dispatch hiccup.
    """
    # Late import so tests can monkeypatch app.worker.enqueue_job (the seam).
    from .. import worker

    try:
        rows = (
            (
                await db.execute(
                    select(JobOutbox)
                    .where(JobOutbox.status == OutboxStatus.pending)
                    .order_by(JobOutbox.created_at)
                    .limit(DISPATCH_BATCH)
                    .with_for_update(skip_locked=True)
                )
            )
            .scalars()
            .all()
        )
        dispatched = 0
        for row in rows:
            try:
                await worker.enqueue_job(row.task_name, **row.payload)
            except Exception as exc:
                row.attempts += 1
                row.last_error = f"{type(exc).__name__}: {exc}"[:2000]
                if row.attempts >= MAX_ATTEMPTS:
                    row.status = OutboxStatus.failed
                    log.error(
                        "outbox.dead_letter",
                        outbox_id=str(row.id),
                        task=row.task_name,
                        attempts=row.attempts,
                    )
                else:
                    log.warning(
                        "outbox.dispatch_failed",
                        outbox_id=str(row.id),
                        task=row.task_name,
                        attempts=row.attempts,
                    )
            else:
                row.status = OutboxStatus.dispatched
                row.dispatched_at = datetime.now(UTC)
                dispatched += 1
        await db.commit()
        return dispatched
    except Exception:
        log.exception("outbox.dispatch_sweep_failed")
        await db.rollback()
        return 0


async def count_failed(db: AsyncSession) -> int:
    """Dead-letter depth — rows parked as `failed` awaiting manual inspection."""
    return (
        await db.execute(
            select(func.count()).select_from(JobOutbox).where(JobOutbox.status == OutboxStatus.failed)
        )
    ).scalar_one()
