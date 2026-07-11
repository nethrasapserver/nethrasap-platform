"""HR — employees, attendance, leave (with balances), holidays, payroll.

An Employee optionally links to a User (so staff who also log in are one
identity), but employees can exist without login accounts.
"""
from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, created_at, updated_at, uuid_pk


class EmployeeStatus(str, enum.Enum):
    active = "active"
    on_leave = "on_leave"
    terminated = "terminated"


class LeaveStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    cancelled = "cancelled"


class AttendanceStatus(str, enum.Enum):
    present = "present"
    absent = "absent"
    half_day = "half_day"
    on_leave = "on_leave"


class PayrollRunStatus(str, enum.Enum):
    draft = "draft"
    processed = "processed"


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[uuid_pk]
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), unique=True
    )
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20))
    department: Mapped[str] = mapped_column(String(80), nullable=False)
    designation: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[EmployeeStatus] = mapped_column(
        SAEnum(EmployeeStatus, name="employee_status", values_callable=lambda e: [m.value for m in e]),
        nullable=False, default=EmployeeStatus.active, server_default=EmployeeStatus.active.value,
    )
    date_joined: Mapped[date] = mapped_column(Date, nullable=False)
    # Monthly salary components (paise).
    basic_salary: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0, server_default="0")
    allowances: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0, server_default="0")

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]

    balances: Mapped[list[LeaveBalance]] = relationship(
        back_populates="employee", cascade="all, delete-orphan", lazy="selectin"
    )


class Holiday(Base):
    __tablename__ = "holidays"

    id: Mapped[uuid_pk]
    day: Mapped[date] = mapped_column(Date, unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    kind: Mapped[str] = mapped_column(String(40), nullable=False, default="national")

    created_at: Mapped[created_at]


class LeaveType(Base):
    __tablename__ = "leave_types"

    id: Mapped[uuid_pk]
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    annual_quota_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[created_at]


class LeaveBalance(Base):
    __tablename__ = "leave_balances"

    id: Mapped[uuid_pk]
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    leave_type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leave_types.id", ondelete="CASCADE"), nullable=False
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    allocated_days: Mapped[float] = mapped_column(Numeric(5, 1), nullable=False, default=0)
    used_days: Mapped[float] = mapped_column(Numeric(5, 1), nullable=False, default=0)

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]

    employee: Mapped[Employee] = relationship(back_populates="balances")

    __table_args__ = (
        UniqueConstraint("employee_id", "leave_type_id", "year", name="uq_leave_balance_emp_type_year"),
    )


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id: Mapped[uuid_pk]
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    leave_type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leave_types.id", ondelete="RESTRICT"), nullable=False
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    days: Mapped[float] = mapped_column(Numeric(5, 1), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    status: Mapped[LeaveStatus] = mapped_column(
        SAEnum(LeaveStatus, name="leave_status", values_callable=lambda e: [m.value for m in e]),
        nullable=False, default=LeaveStatus.pending, server_default=LeaveStatus.pending.value, index=True,
    )
    decided_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decision_note: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id: Mapped[uuid_pk]
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    day: Mapped[date] = mapped_column(Date, nullable=False)
    check_in: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    check_out: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[AttendanceStatus] = mapped_column(
        SAEnum(AttendanceStatus, name="attendance_status", values_callable=lambda e: [m.value for m in e]),
        nullable=False, default=AttendanceStatus.present, server_default=AttendanceStatus.present.value,
    )

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]

    __table_args__ = (
        UniqueConstraint("employee_id", "day", name="uq_attendance_emp_day"),
    )


class PayrollRun(Base):
    __tablename__ = "payroll_runs"

    id: Mapped[uuid_pk]
    period: Mapped[date] = mapped_column(Date, unique=True, nullable=False)  # month first day
    status: Mapped[PayrollRunStatus] = mapped_column(
        SAEnum(PayrollRunStatus, name="payroll_run_status", values_callable=lambda e: [m.value for m in e]),
        nullable=False, default=PayrollRunStatus.draft, server_default=PayrollRunStatus.draft.value,
    )
    total_net_paise: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0, server_default="0")
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]

    payslips: Mapped[list[Payslip]] = relationship(
        back_populates="run", cascade="all, delete-orphan"
    )


class Payslip(Base):
    __tablename__ = "payslips"

    id: Mapped[uuid_pk]
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payroll_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    basic_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    allowances_paise: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    deductions_paise: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    net_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    pdf_storage_key: Mapped[str | None] = mapped_column(String(512))

    created_at: Mapped[created_at]

    run: Mapped[PayrollRun] = relationship(back_populates="payslips")

    __table_args__ = (
        UniqueConstraint("run_id", "employee_id", name="uq_payslip_run_employee"),
    )
