"""HR endpoints — staff-managed (hr:manage) + employee self-service (own record)."""
from __future__ import annotations

from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from pydantic import BaseModel, ConfigDict, Field

from ...db import DbSession
from ...deps import CurrentUser, require_permission
from ...models.user import User
from ...services import hr, payroll

router = APIRouter()

HrManage = Annotated[User, Depends(require_permission("hr:manage"))]


# --- Employees (hr:manage) ---------------------------------------------------


class EmployeeCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    code: str = Field(min_length=1, max_length=20)
    user_id: UUID | None = None
    full_name: str = Field(min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=20)
    department: str = Field(min_length=1, max_length=80)
    designation: str = Field(min_length=1, max_length=80)
    date_joined: date
    basic_salary: int = Field(ge=0)
    allowances: int = Field(default=0, ge=0)


class EmployeeUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    department: str | None = None
    designation: str | None = None
    basic_salary: int | None = Field(default=None, ge=0)
    allowances: int | None = Field(default=None, ge=0)
    status: str | None = None


@router.get("/hr/employees")
async def list_employees(db: DbSession, _a: HrManage) -> dict:
    return {"items": [hr.serialise_employee(e) for e in await hr.list_employees(db)]}


@router.post("/hr/employees", status_code=status.HTTP_201_CREATED)
async def create_employee(payload: EmployeeCreate, db: DbSession, actor: HrManage) -> dict:
    emp = await hr.create_employee(db, actor, payload.model_dump())
    return hr.serialise_employee(emp)


@router.patch("/hr/employees/{employee_id}")
async def update_employee(employee_id: UUID, payload: EmployeeUpdate, db: DbSession, actor: HrManage) -> dict:
    emp = await hr.update_employee(db, actor, employee_id, payload.model_dump(exclude_unset=True))
    return hr.serialise_employee(emp)


# --- Holidays ----------------------------------------------------------------


class HolidayCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    day: date
    name: str = Field(min_length=1, max_length=120)
    kind: str = Field(default="national", max_length=40)


@router.get("/hr/holidays")
async def holidays(db: DbSession, user: CurrentUser, year: Annotated[int | None, Query()] = None) -> dict:
    # Any signed-in user can see the holiday calendar.
    return {"items": await hr.list_holidays(db, year=year)}


@router.post("/hr/holidays", status_code=status.HTTP_201_CREATED)
async def add_holiday(payload: HolidayCreate, db: DbSession, actor: HrManage) -> dict:
    return await hr.add_holiday(db, actor, day=payload.day, name=payload.name, kind=payload.kind)


@router.delete("/hr/holidays/{holiday_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_holiday(holiday_id: UUID, db: DbSession, _a: HrManage) -> Response:
    await hr.delete_holiday(db, holiday_id=holiday_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Attendance (employee self-service) --------------------------------------


@router.post("/hr/attendance/check-in")
async def check_in(db: DbSession, user: CurrentUser) -> dict:
    emp = await hr.employee_for_user(db, user.id)
    return await hr.check_in(db, employee_id=emp.id)


@router.post("/hr/attendance/check-out")
async def check_out(db: DbSession, user: CurrentUser) -> dict:
    emp = await hr.employee_for_user(db, user.id)
    return await hr.check_out(db, employee_id=emp.id)


@router.get("/hr/attendance/me")
async def my_attendance(db: DbSession, user: CurrentUser) -> dict:
    emp = await hr.employee_for_user(db, user.id)
    return {"items": await hr.list_attendance(db, employee_id=emp.id)}


@router.get("/hr/attendance/{employee_id}")
async def employee_attendance(employee_id: UUID, db: DbSession, _a: HrManage) -> dict:
    return {"items": await hr.list_attendance(db, employee_id=employee_id)}


# --- Leave -------------------------------------------------------------------


class LeaveApply(BaseModel):
    leave_type_id: UUID
    start_date: date
    end_date: date
    reason: str | None = Field(default=None, max_length=500)


class LeaveDecision(BaseModel):
    approve: bool
    note: str | None = Field(default=None, max_length=500)


@router.post("/hr/leave", status_code=status.HTTP_201_CREATED)
async def apply_leave(payload: LeaveApply, db: DbSession, user: CurrentUser) -> dict:
    emp = await hr.employee_for_user(db, user.id)
    return await hr.apply_leave(
        db, employee_id=emp.id, leave_type_id=payload.leave_type_id,
        start=payload.start_date, end=payload.end_date, reason=payload.reason,
    )


@router.get("/hr/leave/me")
async def my_leave(db: DbSession, user: CurrentUser) -> dict:
    emp = await hr.employee_for_user(db, user.id)
    return {"items": await hr.list_leave(db, employee_id=emp.id, status_filter=None)}


@router.get("/hr/leave")
async def leave_queue(
    db: DbSession, _a: HrManage, status_filter: Annotated[str | None, Query(alias="status")] = None
) -> dict:
    return {"items": await hr.list_leave(db, employee_id=None, status_filter=status_filter)}


@router.post("/hr/leave/{request_id}/decision")
async def decide_leave(request_id: UUID, payload: LeaveDecision, db: DbSession, actor: HrManage) -> dict:
    return await hr.decide_leave(db, actor, request_id=request_id, approve=payload.approve, note=payload.note)


# --- Payroll -----------------------------------------------------------------


class PayrollRunInput(BaseModel):
    period: date


@router.post("/hr/payroll/runs", status_code=status.HTTP_201_CREATED)
async def run_payroll(payload: PayrollRunInput, db: DbSession, actor: HrManage) -> dict:
    return await payroll.run_payroll(db, actor, period=payload.period)


@router.get("/hr/payroll/me")
async def my_payslips(db: DbSession, user: CurrentUser) -> dict:
    emp = await hr.employee_for_user(db, user.id)
    return {"items": await payroll.list_my_payslips(db, employee_id=emp.id)}


@router.get("/hr/payslips/{payslip_id}")
async def payslip_download(payslip_id: UUID, db: DbSession, user: CurrentUser) -> dict:
    from ...deps import permission_matches

    # HR staff can pull anyone's; employees only their own.
    from ...services import auth as auth_svc
    perms = await auth_svc.load_permissions(db, user)
    is_hr = permission_matches(perms, "hr:manage")
    return await payroll.get_payslip_url(db, user, payslip_id=payslip_id, is_hr=is_hr)
