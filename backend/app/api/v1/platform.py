"""Super-admin **Platform Ops** console (Gate 4 Wave 2).

A single surface for the platform operator: system health, the audit trail,
feature-flag toggles, and external-integration wiring status. Every endpoint
is gated on the `platform:admin` permission (granted to the `admin` role only).

Nothing here needs a new table — it reads existing tables (`audit_log`,
`feature_flags`, `job_outbox`), Redis (worker heartbeat), and config.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text

from ...config import get_settings
from ...db import DbSession
from ...deps import Paged, require_permission
from ...integrations import razorpay, storage
from ...models.audit import AuditLog
from ...models.cms import FeatureFlag  # noqa: F401  (documents the table read via cms service)
from ...models.outbox import JobOutbox
from ...models.user import User
from ...redis import get_redis
from ...schemas.common import Paginated
from ...schemas.platform import (
    AuditItem,
    FeatureFlagOut,
    FlagUpdate,
    IntegrationOut,
    PlatformStatus,
    QueueCounts,
    ServiceStatus,
    WorkerHeartbeat,
)
from ...services import cms

router = APIRouter()

# Every endpoint requires the platform super-admin permission; capturing the
# User (rather than gating the whole router) lets the write endpoints attribute
# the audit row to the acting admin.
PlatformAdmin = Annotated[User, Depends(require_permission("platform:admin"))]

# Cap dependency probes so a hung backend can't stall the ops console.
_PROBE_TIMEOUT_S = 3.0
# Mirror the worker's key (app/worker.py:WORKER_HEARTBEAT_KEY). The worker writes
# it with a 120s TTL and refreshes twice a minute; we flag stale past ~90s.
_WORKER_HEARTBEAT_KEY = "worker:heartbeat"
_HEARTBEAT_STALE_AFTER_S = 90


# --- GET /platform/status ----------------------------------------------------


@router.get("/status", response_model=PlatformStatus)
async def platform_status(db: DbSession, admin: PlatformAdmin) -> PlatformStatus:
    """System health for the ops console: postgres, redis, worker heartbeat,
    outbox depth, and build identity."""
    settings = get_settings()

    # Redis + worker heartbeat (one connection, two reads).
    redis_ok = False
    last_heartbeat: str | None = None
    hb_age: float | None = None
    try:
        r = get_redis()
        await asyncio.wait_for(r.ping(), timeout=_PROBE_TIMEOUT_S)
        redis_ok = True
        raw = await asyncio.wait_for(r.get(_WORKER_HEARTBEAT_KEY), timeout=_PROBE_TIMEOUT_S)
        if raw:
            last_heartbeat = raw if isinstance(raw, str) else raw.decode()
            try:
                ts = datetime.fromisoformat(last_heartbeat)
                hb_age = (datetime.now(UTC) - ts).total_seconds()
            except ValueError:
                hb_age = None
    except Exception:
        redis_ok = False

    stale = hb_age is None or hb_age > _HEARTBEAT_STALE_AFTER_S
    if last_heartbeat is None:
        worker_state = "down"
    elif stale:
        worker_state = "stale"
    else:
        worker_state = "ok"

    # Postgres liveness + outbox depth.
    db_ok = False
    counts = {"pending": 0, "failed": 0, "dispatched": 0}
    try:
        await asyncio.wait_for(db.execute(text("SELECT 1")), timeout=_PROBE_TIMEOUT_S)
        db_ok = True
    except Exception:
        db_ok = False
    if db_ok:
        try:
            rows = (
                await db.execute(
                    select(JobOutbox.status, func.count()).group_by(JobOutbox.status)
                )
            ).all()
            for st, cnt in rows:
                key = st.value if hasattr(st, "value") else str(st)
                if key in counts:
                    counts[key] = int(cnt)
        except Exception:
            pass

    return PlatformStatus(
        services=ServiceStatus(
            database="ok" if db_ok else "error",
            redis="ok" if redis_ok else "error",
            worker=worker_state,
        ),
        queue=QueueCounts(**counts),
        worker=WorkerHeartbeat(last_heartbeat=last_heartbeat, stale=stale),
        version=settings.app_version,
        git_sha=settings.git_sha or None,
    )


# --- GET /platform/audit -----------------------------------------------------


@router.get("/audit", response_model=Paginated[AuditItem])
async def platform_audit(
    db: DbSession,
    admin: PlatformAdmin,
    page: Paged,
    action: Annotated[str | None, Query(description="substring match on action")] = None,
    actor_user_id: Annotated[uuid.UUID | None, Query()] = None,
    entity_type: Annotated[str | None, Query()] = None,
) -> Paginated[AuditItem]:
    """Paginated audit trail, newest first, with optional filters."""
    filters = []
    if action:
        filters.append(AuditLog.action.ilike(f"%{action}%"))
    if actor_user_id is not None:
        filters.append(AuditLog.actor_user_id == actor_user_id)
    if entity_type:
        filters.append(AuditLog.entity_type == entity_type)

    total = (
        await db.execute(select(func.count()).select_from(AuditLog).where(*filters))
    ).scalar_one()

    rows = (
        await db.execute(
            select(AuditLog, User.phone)
            .outerjoin(User, User.id == AuditLog.actor_user_id)
            .where(*filters)
            .order_by(AuditLog.created_at.desc())
            .limit(page.limit)
            .offset(page.offset)
        )
    ).all()

    items = [
        AuditItem(
            id=a.id,
            action=a.action,
            entity_type=a.entity_type,
            entity_id=a.entity_id,
            actor_user_id=a.actor_user_id,
            actor_phone=phone,
            payload=a.payload,
            created_at=a.created_at,
        )
        for a, phone in rows
    ]
    return Paginated[AuditItem](total=total, limit=page.limit, offset=page.offset, items=items)


# --- feature flags -----------------------------------------------------------


@router.get("/feature-flags", response_model=list[FeatureFlagOut])
async def list_feature_flags(db: DbSession, admin: PlatformAdmin) -> list[FeatureFlag]:
    return await cms.list_flags(db)


@router.put("/feature-flags/{key}", response_model=FeatureFlagOut)
async def set_feature_flag(
    key: str, body: FlagUpdate, db: DbSession, admin: PlatformAdmin
) -> FeatureFlag:
    """Toggle a feature flag. Upserts the row and writes an audit_log entry
    (who/what) via the shared CMS service."""
    return await cms.put_flag(db, admin, key=key, enabled=body.enabled, description=None)


# --- GET /platform/integrations ---------------------------------------------


@router.get("/integrations", response_model=list[IntegrationOut])
async def list_integrations(admin: PlatformAdmin) -> list[IntegrationOut]:
    """Non-secret wiring status of external integrations — booleans + names
    only, never any credential value."""
    settings = get_settings()

    sms_provider = settings.sms_provider
    sms_configured = sms_provider != "console" and bool(settings.sms_api_key)

    return [
        IntegrationOut(name="sms", configured=sms_configured, detail=sms_provider),
        IntegrationOut(
            name="storage",
            configured=storage.is_configured(),
            detail=settings.storage_bucket or None,
        ),
        IntegrationOut(name="razorpay", configured=razorpay.is_configured(), detail=None),
        IntegrationOut(
            name="payment_methods",
            configured=bool(settings.payment_methods_enabled_list),
            detail=",".join(settings.payment_methods_enabled_list) or None,
        ),
    ]
