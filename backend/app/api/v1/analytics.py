"""Analytics, sales org, and audit-log endpoints (staff)."""
from __future__ import annotations

from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from ...db import DbSession
from ...deps import require_permission
from ...models.audit import AuditLog
from ...models.user import User
from ...services import analytics as an
from ...services import sales_org as org

router = APIRouter()

AnalyticsStaff = Annotated[User, Depends(require_permission("analytics:read"))]
SalesStaff = Annotated[User, Depends(require_permission("sales:read"))]
SalesManage = Annotated[User, Depends(require_permission("sales:manage"))]
AuditReader = Annotated[User, Depends(require_permission("audit:read"))]


# --- Analytics ---------------------------------------------------------------


@router.get("/analytics/kpis")
async def kpis(db: DbSession, _a: AnalyticsStaff, days: Annotated[int, Query(ge=1, le=365)] = 30) -> dict:
    return await an.kpis(db, days=days)


@router.get("/analytics/revenue-trend")
async def revenue_trend(db: DbSession, _a: AnalyticsStaff, days: Annotated[int, Query(ge=1, le=365)] = 30) -> dict:
    return {"series": await an.revenue_trend(db, days=days)}


@router.get("/analytics/top-products")
async def top_products(
    db: DbSession, _a: AnalyticsStaff,
    days: Annotated[int, Query(ge=1, le=365)] = 30,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
) -> dict:
    return {"items": await an.top_products(db, days=days, limit=limit)}


@router.get("/analytics/dashboard")
async def dashboard(
    db: DbSession, actor: AnalyticsStaff,
    portal: Annotated[str, Query(pattern="^(sales|manager|admin)$")] = "admin",
    days: Annotated[int, Query(ge=1, le=365)] = 30,
) -> dict:
    return await an.dashboard(db, portal=portal, days=days)


# --- Sales org ---------------------------------------------------------------


@router.get("/sales/team")
async def sales_team(db: DbSession, _a: SalesStaff, days: Annotated[int, Query(ge=1, le=365)] = 30) -> dict:
    return {"team": await an.team(db, days=days)}


@router.get("/sales/performance/{rep_id}")
async def rep_performance(rep_id: UUID, db: DbSession, _a: SalesStaff, days: Annotated[int, Query(ge=1, le=365)] = 30) -> dict:
    return await an.rep_performance(db, rep_id=rep_id, days=days)


@router.get("/sales/assignments")
async def list_assignments(
    db: DbSession, _a: SalesStaff, rep_id: Annotated[UUID | None, Query()] = None
) -> dict:
    return {"assignments": await org.list_assignments(db, rep_id=rep_id)}


class AssignInput(BaseModel):
    customer_id: UUID
    rep_id: UUID


@router.post("/sales/assignments")
async def assign(payload: AssignInput, db: DbSession, actor: SalesManage) -> dict:
    return await org.assign_customer(db, actor, customer_id=payload.customer_id, rep_id=payload.rep_id)


@router.delete("/sales/assignments/{customer_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def unassign(customer_id: UUID, db: DbSession, actor: SalesManage) -> Response:
    await org.unassign_customer(db, actor, customer_id=customer_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


class TargetInput(BaseModel):
    rep_id: UUID
    period: date
    target_paise: int = Field(ge=0)
    label: str | None = Field(default=None, max_length=50)


@router.put("/sales/targets")
async def set_target(payload: TargetInput, db: DbSession, actor: SalesManage) -> dict:
    return await org.set_target(
        db, actor, rep_id=payload.rep_id, period=payload.period,
        target_paise=payload.target_paise, label=payload.label,
    )


@router.get("/sales/targets/{rep_id}")
async def list_targets(rep_id: UUID, db: DbSession, _a: SalesStaff) -> dict:
    return {"targets": await org.list_targets(db, rep_id=rep_id)}


# --- Audit viewer ------------------------------------------------------------


@router.get("/admin/audit")
async def audit_log(
    db: DbSession,
    _a: AuditReader,
    action: Annotated[str | None, Query()] = None,
    entity_type: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> dict:
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    rows = (await db.execute(stmt.limit(limit).offset(offset))).scalars()
    return {
        "items": [
            {
                "id": a.id,
                "actor_user_id": a.actor_user_id,
                "action": a.action,
                "entity_type": a.entity_type,
                "entity_id": a.entity_id,
                "payload": a.payload,
                "ip": a.ip,
                "created_at": a.created_at,
            }
            for a in rows
        ]
    }
