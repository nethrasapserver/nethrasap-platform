"""Liveness + readiness probes (M3).

``/health`` is a dependency-free liveness signal (is the process up?) plus
build/version info. ``/ready`` is the readiness signal: it verifies the two
hard runtime dependencies — Postgres and Redis — and returns 503 naming the
failed dependency if either is down, so an orchestrator can withhold traffic
until the instance can actually serve.
"""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Response
from sqlalchemy import text

from ...config import get_settings
from ...db import DbSession
from ...redis import get_redis

router = APIRouter()

settings = get_settings()

# Cap the readiness dependency checks so a hung dependency can't stall the probe
# (Postgres also has a server-side statement_timeout from M10).
_READY_CHECK_TIMEOUT_S = 3.0
# The worker refreshes `worker:heartbeat` with a short TTL; anything older than
# this is reported stale (informational only — it does not fail readiness).
_HEARTBEAT_STALE_AFTER_S = 180


@router.get("/health")
async def health() -> dict:
    """Liveness: no external dependencies touched."""
    return {
        "status": "ok",
        "service": "nethrasap-api",
        "version": settings.app_version,
        "git_sha": settings.git_sha or None,
        "environment": settings.environment,
    }


async def _check_db(db) -> bool:
    await asyncio.wait_for(db.execute(text("SELECT 1")), timeout=_READY_CHECK_TIMEOUT_S)
    return True


async def _check_redis() -> bool:
    await asyncio.wait_for(get_redis().ping(), timeout=_READY_CHECK_TIMEOUT_S)
    return True


async def _worker_heartbeat_age() -> float | None:
    """Seconds since the worker last wrote its heartbeat, or None if unknown."""
    from datetime import UTC, datetime

    raw = await asyncio.wait_for(
        get_redis().get("worker:heartbeat"), timeout=_READY_CHECK_TIMEOUT_S
    )
    if not raw:
        return None
    ts = datetime.fromisoformat(raw if isinstance(raw, str) else raw.decode())
    return (datetime.now(UTC) - ts).total_seconds()


@router.get("/ready")
async def ready(response: Response, db: DbSession) -> dict:
    """Readiness: both Postgres and Redis must be reachable, else 503."""
    checks: dict[str, str] = {}
    healthy = True

    try:
        await _check_db(db)
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "error"
        healthy = False

    try:
        await _check_redis()
        checks["redis"] = "ok"
    except Exception:
        checks["redis"] = "error"
        healthy = False

    # Worker liveness is surfaced but does NOT gate readiness of the API: the
    # web tier can serve reads/writes even if the background worker is down, and
    # the worker may legitimately not be running in dev/test. The Platform Ops
    # dashboard treats a stale/missing heartbeat as its own alert.
    try:
        age = await _worker_heartbeat_age()
        if age is None:
            checks["worker_heartbeat"] = "unknown"
        elif age <= _HEARTBEAT_STALE_AFTER_S:
            checks["worker_heartbeat"] = "ok"
        else:
            checks["worker_heartbeat"] = "stale"
    except Exception:
        checks["worker_heartbeat"] = "unknown"

    if not healthy:
        response.status_code = 503
        return {"status": "not_ready", "checks": checks}
    return {"status": "ready", "checks": checks}
