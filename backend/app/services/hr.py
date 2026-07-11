"""HR services — employees, attendance, leave (balance-aware), holidays."""
from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..logging import get_logger
from ..models.audit import AuditLog
from ..models.hr import (
    AttendanceRecord,
    AttendanceStatus,
    Employee,
    Holiday,
    LeaveBalance,
    LeaveRequest,
    LeaveStatus,
    LeaveType,
)
from ..models.user import User
from . import notifications as notify_svc
from .notifications import NotificationType

log = get_logger("services.hr")


# --- Employees ----------------------------------------------------------------


async def create_employee(db: AsyncSession, actor: User, data: dict) -> Employee:
    dup = (await db.execute(select(Employee.id).where(Employee.code == data["code"]))).scalar_one_or_none()
    if dup:
        raise HTTPException(status.HTTP_409_CONFLICT, f"employee code exists: {data['code']}")
    emp = Employee(**data)
    db.add(emp)
    db.add(AuditLog(actor_user_id=actor.id, action="hr.employee_created", entity_type="employee",
                    entity_id=data["code"], payload={"name": data["full_name"]}))
    await db.commit()
    return await _load_employee(db, emp.id)


async def update_employee(db: AsyncSession, actor: User, employee_id: uuid.UUID, data: dict) -> Employee:
    emp = await _load_employee(db, employee_id)
    for k, v in {k: v for k, v in data.items() if v is not None}.items():
        setattr(emp, k, v)
    db.add(AuditLog(actor_user_id=actor.id, action="hr.employee_updated", entity_type="employee",
                    entity_id=emp.code, payload={"fields": sorted(data)}))
    await db.commit()
    return await _load_employee(db, employee_id)


async def list_employees(db: AsyncSession) -> list[Employee]:
    return list((await db.execute(select(Employee).order_by(Employee.code))).scalars())


async def _load_employee(db: AsyncSession, employee_id: uuid.UUID) -> Employee:
    emp = (
        await db.execute(
            select(Employee).where(Employee.id == employee_id).execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if emp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "employee not found")
    return emp


async def employee_for_user(db: AsyncSession, user_id: uuid.UUID) -> Employee:
    emp = (await db.execute(select(Employee).where(Employee.user_id == user_id))).scalar_one_or_none()
    if emp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "no employee record linked to your account")
    return emp


# --- Holidays -----------------------------------------------------------------


async def list_holidays(db: AsyncSession, *, year: int | None) -> list[dict[str, Any]]:
    stmt = select(Holiday).order_by(Holiday.day)
    rows = (await db.execute(stmt)).scalars()
    out: list[dict[str, Any]] = [
        {"id": h.id, "day": h.day.isoformat(), "name": h.name, "kind": h.kind} for h in rows
    ]
    if year:
        out = [h for h in out if str(h["day"]).startswith(str(year))]
    return out


async def add_holiday(db: AsyncSession, actor: User, *, day: date, name: str, kind: str) -> dict[str, Any]:
    dup = (await db.execute(select(Holiday.id).where(Holiday.day == day))).scalar_one_or_none()
    if dup:
        raise HTTPException(status.HTTP_409_CONFLICT, "holiday already exists on that date")
    h = Holiday(day=day, name=name, kind=kind)
    db.add(h)
    await db.commit()
    return {"id": h.id, "day": day.isoformat(), "name": name, "kind": kind}


async def delete_holiday(db: AsyncSession, *, holiday_id: uuid.UUID) -> None:
    h = (await db.execute(select(Holiday).where(Holiday.id == holiday_id))).scalar_one_or_none()
    if h is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "holiday not found")
    await db.delete(h)
    await db.commit()


# --- Attendance ---------------------------------------------------------------


async def check_in(db: AsyncSession, *, employee_id: uuid.UUID) -> dict[str, Any]:
    today = datetime.now(UTC).date()
    rec = (
        await db.execute(
            select(AttendanceRecord).where(
                AttendanceRecord.employee_id == employee_id, AttendanceRecord.day == today
            )
        )
    ).scalar_one_or_none()
    now = datetime.now(UTC)
    if rec is None:
        rec = AttendanceRecord(employee_id=employee_id, day=today, check_in=now, status=AttendanceStatus.present)
        db.add(rec)
    elif rec.check_in is None:
        rec.check_in = now
    else:
        raise HTTPException(status.HTTP_409_CONFLICT, "already checked in today")
    await db.commit()
    return _attendance_out(rec)


async def check_out(db: AsyncSession, *, employee_id: uuid.UUID) -> dict[str, Any]:
    today = datetime.now(UTC).date()
    rec = (
        await db.execute(
            select(AttendanceRecord).where(
                AttendanceRecord.employee_id == employee_id, AttendanceRecord.day == today
            )
        )
    ).scalar_one_or_none()
    if rec is None or rec.check_in is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "check in first")
    rec.check_out = datetime.now(UTC)
    await db.commit()
    return _attendance_out(rec)


async def list_attendance(db: AsyncSession, *, employee_id: uuid.UUID) -> list[dict[str, Any]]:
    rows = (
        await db.execute(
            select(AttendanceRecord)
            .where(AttendanceRecord.employee_id == employee_id)
            .order_by(AttendanceRecord.day.desc())
            .limit(60)
        )
    ).scalars()
    return [_attendance_out(r) for r in rows]


def _attendance_out(r: AttendanceRecord) -> dict[str, Any]:
    return {
        "id": r.id, "day": r.day.isoformat(), "check_in": r.check_in,
        "check_out": r.check_out, "status": r.status.value,
    }


# --- Leave (balance-aware) ----------------------------------------------------


async def _balance(db: AsyncSession, employee_id: uuid.UUID, leave_type_id: uuid.UUID, year: int) -> LeaveBalance:
    bal = (
        await db.execute(
            select(LeaveBalance).where(
                LeaveBalance.employee_id == employee_id,
                LeaveBalance.leave_type_id == leave_type_id,
                LeaveBalance.year == year,
            )
        )
    ).scalar_one_or_none()
    if bal is None:
        lt = (await db.execute(select(LeaveType).where(LeaveType.id == leave_type_id))).scalar_one_or_none()
        if lt is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "unknown leave type")
        bal = LeaveBalance(
            employee_id=employee_id, leave_type_id=leave_type_id, year=year,
            allocated_days=Decimal(lt.annual_quota_days), used_days=Decimal(0),
        )
        db.add(bal)
        await db.flush()
    return bal


async def apply_leave(
    db: AsyncSession, *, employee_id: uuid.UUID, leave_type_id: uuid.UUID,
    start: date, end: date, reason: str | None,
) -> dict[str, Any]:
    if end < start:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "end_date before start_date")
    days = Decimal((end - start).days + 1)
    year = start.year
    bal = await _balance(db, employee_id, leave_type_id, year)
    remaining = bal.allocated_days - bal.used_days
    if days > remaining:
        raise HTTPException(status.HTTP_409_CONFLICT, f"insufficient balance ({remaining} days left)")

    req = LeaveRequest(
        employee_id=employee_id, leave_type_id=leave_type_id, start_date=start, end_date=end,
        days=days, reason=reason, status=LeaveStatus.pending,
    )
    db.add(req)
    await db.commit()
    return await _leave_out(db, req.id)


async def decide_leave(
    db: AsyncSession, actor: User, *, request_id: uuid.UUID, approve: bool, note: str | None
) -> dict[str, Any]:
    req = (await db.execute(select(LeaveRequest).where(LeaveRequest.id == request_id))).scalar_one_or_none()
    if req is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "leave request not found")
    if req.status != LeaveStatus.pending:
        raise HTTPException(status.HTTP_409_CONFLICT, f"already {req.status.value}")

    now = datetime.now(UTC)
    req.decided_by = actor.id
    req.decided_at = now
    req.decision_note = note
    if approve:
        req.status = LeaveStatus.approved
        bal = await _balance(db, req.employee_id, req.leave_type_id, req.start_date.year)
        bal.used_days = bal.used_days + req.days
    else:
        req.status = LeaveStatus.rejected

    db.add(AuditLog(actor_user_id=actor.id, action=f"hr.leave_{req.status.value}", entity_type="leave_request",
                    entity_id=str(req.id), payload={"days": float(req.days)}))
    # Notify the employee if they have a linked user account.
    emp = await _load_employee(db, req.employee_id)
    if emp.user_id:
        await notify_svc.notify(
            db, user_id=emp.user_id, type=NotificationType.system,
            title=f"Leave {req.status.value}", body=note, link="/hr-leave",
        )
    await db.commit()
    return await _leave_out(db, req.id)


async def list_leave(
    db: AsyncSession, *, employee_id: uuid.UUID | None, status_filter: str | None
) -> list[dict[str, Any]]:
    stmt = select(LeaveRequest).order_by(LeaveRequest.created_at.desc())
    if employee_id:
        stmt = stmt.where(LeaveRequest.employee_id == employee_id)
    if status_filter:
        stmt = stmt.where(LeaveRequest.status == LeaveStatus(status_filter))
    rows = (await db.execute(stmt)).scalars()
    return [_leave_row(r) for r in rows]


async def _leave_out(db: AsyncSession, request_id: uuid.UUID) -> dict[str, Any]:
    req = (await db.execute(select(LeaveRequest).where(LeaveRequest.id == request_id))).scalar_one()
    return _leave_row(req)


def _leave_row(r: LeaveRequest) -> dict[str, Any]:
    return {
        "id": r.id, "employee_id": r.employee_id, "leave_type_id": r.leave_type_id,
        "start_date": r.start_date.isoformat(), "end_date": r.end_date.isoformat(),
        "days": float(r.days), "reason": r.reason, "status": r.status.value,
        "decision_note": r.decision_note,
    }


def serialise_employee(emp: Employee) -> dict[str, Any]:
    return {
        "id": emp.id, "code": emp.code, "user_id": emp.user_id, "full_name": emp.full_name,
        "phone": emp.phone, "department": emp.department, "designation": emp.designation,
        "status": emp.status.value, "date_joined": emp.date_joined.isoformat(),
        "basic_salary": emp.basic_salary, "allowances": emp.allowances,
    }
