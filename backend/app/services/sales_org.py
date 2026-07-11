"""Sales org management — assignments (book of accounts) and targets."""
from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.audit import AuditLog
from ..models.sales import SalesAssignment, SalesTarget
from ..models.user import User, UserRole


async def assign_customer(
    db: AsyncSession, actor: User, *, customer_id: uuid.UUID, rep_id: uuid.UUID
) -> dict[str, Any]:
    rep = (await db.execute(select(User).where(User.id == rep_id))).scalar_one_or_none()
    if rep is None or rep.role != UserRole.sales:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "rep_id must be a sales user")

    now = datetime.now(UTC)
    # End any current active assignment for this customer.
    current = (
        await db.execute(
            select(SalesAssignment).where(
                SalesAssignment.customer_id == customer_id, SalesAssignment.ended_at.is_(None)
            )
        )
    ).scalar_one_or_none()
    if current is not None:
        if current.rep_id == rep_id:
            return _assignment_out(current)
        current.ended_at = now

    assignment = SalesAssignment(customer_id=customer_id, rep_id=rep_id, started_at=now)
    db.add(assignment)
    db.add(
        AuditLog(
            actor_user_id=actor.id, action="sales.assigned", entity_type="user",
            entity_id=str(customer_id), payload={"rep_id": str(rep_id)},
        )
    )
    await db.commit()
    return _assignment_out(assignment)


async def unassign_customer(db: AsyncSession, actor: User, *, customer_id: uuid.UUID) -> None:
    current = (
        await db.execute(
            select(SalesAssignment).where(
                SalesAssignment.customer_id == customer_id, SalesAssignment.ended_at.is_(None)
            )
        )
    ).scalar_one_or_none()
    if current is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "no active assignment")
    current.ended_at = datetime.now(UTC)
    db.add(
        AuditLog(
            actor_user_id=actor.id, action="sales.unassigned", entity_type="user",
            entity_id=str(customer_id), payload={"rep_id": str(current.rep_id)},
        )
    )
    await db.commit()


async def list_assignments(db: AsyncSession, *, rep_id: uuid.UUID | None) -> list[dict[str, Any]]:
    stmt = select(SalesAssignment).where(SalesAssignment.ended_at.is_(None))
    if rep_id:
        stmt = stmt.where(SalesAssignment.rep_id == rep_id)
    rows = (await db.execute(stmt.order_by(SalesAssignment.started_at.desc()))).scalars()
    return [_assignment_out(a) for a in rows]


async def set_target(
    db: AsyncSession, actor: User, *, rep_id: uuid.UUID, period: date, target_paise: int, label: str | None
) -> dict[str, Any]:
    existing = (
        await db.execute(
            select(SalesTarget).where(SalesTarget.rep_id == rep_id, SalesTarget.period == period)
        )
    ).scalar_one_or_none()
    if existing is not None:
        existing.target_paise = target_paise
        existing.label = label
        target = existing
    else:
        target = SalesTarget(rep_id=rep_id, period=period, target_paise=target_paise, label=label)
        db.add(target)
    db.add(
        AuditLog(
            actor_user_id=actor.id, action="sales.target_set", entity_type="user",
            entity_id=str(rep_id), payload={"period": period.isoformat(), "target": target_paise},
        )
    )
    await db.commit()
    return {"rep_id": rep_id, "period": period.isoformat(), "target_paise": target_paise, "label": label}


async def list_targets(db: AsyncSession, *, rep_id: uuid.UUID) -> list[dict[str, Any]]:
    rows = (
        await db.execute(
            select(SalesTarget).where(SalesTarget.rep_id == rep_id).order_by(SalesTarget.period.desc())
        )
    ).scalars()
    return [
        {"period": t.period.isoformat(), "target_paise": t.target_paise, "label": t.label} for t in rows
    ]


def _assignment_out(a: SalesAssignment) -> dict[str, Any]:
    return {
        "id": a.id,
        "customer_id": a.customer_id,
        "rep_id": a.rep_id,
        "started_at": a.started_at,
        "ended_at": a.ended_at,
    }
