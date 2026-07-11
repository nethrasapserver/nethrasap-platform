"""arq background worker.

Run locally:
    uv run arq app.worker.WorkerSettings         (or `make worker` at repo root)

Job registry grows with each workstream: SMS dispatch now; webhook processing,
invoice/payslip PDFs, payroll runs, analytics rollups, cleanup later. Jobs are
enqueued via `enqueue_job()` below, which degrades to inline execution in dev
when Redis is down so flows still work before `docker compose up`.
"""
from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any, ClassVar

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings

from .config import get_settings
from .integrations import sms
from .logging import configure_logging, get_logger

settings = get_settings()
log = get_logger("worker")

_pool: ArqRedis | None = None


async def get_arq_pool() -> ArqRedis:
    global _pool
    if _pool is None:
        _pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    return _pool


async def enqueue_job(name: str, *args: Any, **kwargs: Any) -> None:
    """Enqueue a background job; in dev, fall back to running it inline if
    the queue is unreachable (so OTP/notifications work without Redis up)."""
    if settings.environment == "test":
        # Tests exercise task bodies directly; don't leak jobs onto a shared
        # Redis/worker (which would run against the non-test database).
        return
    try:
        pool = await get_arq_pool()
        await pool.enqueue_job(name, *args, **kwargs)
    except Exception:
        if not settings.is_dev:
            log.exception("enqueue_failed", job=name)
            raise
        log.warning("enqueue_unavailable_running_inline", job=name)
        fn = _TASKS[name]
        await fn({}, *args, **kwargs)


# --- Tasks -------------------------------------------------------------------


async def send_sms_task(ctx: dict, *, to: str, body: str) -> None:
    sms.send_sms(to=to, body=body)


async def generate_invoice_pdf(ctx: dict, *, order_number: str) -> None:
    """Render + store an order's invoice PDF. Opens its own DB session."""
    from .db import SessionLocal
    from .services import invoices

    async with SessionLocal() as db:
        await invoices.generate_for_order(db, order_number)


async def generate_payslips(ctx: dict, *, run_id: str) -> None:
    """Render + store payslip PDFs for a payroll run."""
    import uuid

    from .db import SessionLocal
    from .services import payroll

    async with SessionLocal() as db:
        await payroll.generate_payslip_pdfs(db, uuid.UUID(run_id))


_TASKS: dict[str, Callable[..., Awaitable[None]]] = {
    "send_sms_task": send_sms_task,
    "generate_invoice_pdf": generate_invoice_pdf,
    "generate_payslips": generate_payslips,
}


# --- Worker settings -----------------------------------------------------------


async def startup(ctx: dict) -> None:
    configure_logging(environment=settings.environment, level=settings.log_level)
    log.info("worker.startup", environment=settings.environment)


async def shutdown(ctx: dict) -> None:
    log.info("worker.shutdown")


class WorkerSettings:
    functions: ClassVar = [send_sms_task, generate_invoice_pdf, generate_payslips]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    max_retries = 3
    job_timeout = 120
