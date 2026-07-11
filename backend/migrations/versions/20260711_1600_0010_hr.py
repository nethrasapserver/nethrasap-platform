"""B7: HR — employees, attendance, leave, holidays, payroll.

Revision ID: 0010_hr
Revises: 0009_sales_org
Create Date: 2026-07-11
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0010_hr"
down_revision: str | Sequence[str] | None = "0009_sales_org"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

EMPLOYEE_STATUS = ("active", "on_leave", "terminated")
LEAVE_STATUS = ("pending", "approved", "rejected", "cancelled")
ATTENDANCE_STATUS = ("present", "absent", "half_day", "on_leave")
PAYROLL_RUN_STATUS = ("draft", "processed")

UUID_PK = dict(primary_key=True, server_default=sa.text("gen_random_uuid()"))


def _uuid():
    return postgresql.UUID(as_uuid=True)


def _ts():
    return sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()"))


def _uts():
    return sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()"))


def upgrade() -> None:
    for name, values in [
        ("employee_status", EMPLOYEE_STATUS),
        ("leave_status", LEAVE_STATUS),
        ("attendance_status", ATTENDANCE_STATUS),
        ("payroll_run_status", PAYROLL_RUN_STATUS),
    ]:
        postgresql.ENUM(*values, name=name).create(op.get_bind(), checkfirst=True)

    op.create_table(
        "employees",
        sa.Column("id", _uuid(), **UUID_PK),
        sa.Column("code", sa.String(20), nullable=False),
        sa.Column("user_id", _uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, unique=True),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("department", sa.String(80), nullable=False),
        sa.Column("designation", sa.String(80), nullable=False),
        sa.Column("status", postgresql.ENUM(*EMPLOYEE_STATUS, name="employee_status", create_type=False),
                  nullable=False, server_default="active"),
        sa.Column("date_joined", sa.Date(), nullable=False),
        sa.Column("basic_salary", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("allowances", sa.BigInteger(), nullable=False, server_default="0"),
        _ts(), _uts(),
    )
    op.create_index("ix_employees_code", "employees", ["code"], unique=True)

    op.create_table(
        "holidays",
        sa.Column("id", _uuid(), **UUID_PK),
        sa.Column("day", sa.Date(), nullable=False, unique=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("kind", sa.String(40), nullable=False, server_default="national"),
        _ts(),
    )
    op.create_index("ix_holidays_day", "holidays", ["day"], unique=True)

    op.create_table(
        "leave_types",
        sa.Column("id", _uuid(), **UUID_PK),
        sa.Column("code", sa.String(20), nullable=False, unique=True),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("annual_quota_days", sa.Integer(), nullable=False, server_default="0"),
        _ts(),
    )

    op.create_table(
        "leave_balances",
        sa.Column("id", _uuid(), **UUID_PK),
        sa.Column("employee_id", _uuid(), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("leave_type_id", _uuid(), sa.ForeignKey("leave_types.id", ondelete="CASCADE"), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("allocated_days", sa.Numeric(5, 1), nullable=False, server_default="0"),
        sa.Column("used_days", sa.Numeric(5, 1), nullable=False, server_default="0"),
        _ts(), _uts(),
        sa.UniqueConstraint("employee_id", "leave_type_id", "year", name="uq_leave_balance_emp_type_year"),
    )
    op.create_index("ix_leave_balances_employee_id", "leave_balances", ["employee_id"])

    op.create_table(
        "leave_requests",
        sa.Column("id", _uuid(), **UUID_PK),
        sa.Column("employee_id", _uuid(), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("leave_type_id", _uuid(), sa.ForeignKey("leave_types.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("days", sa.Numeric(5, 1), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("status", postgresql.ENUM(*LEAVE_STATUS, name="leave_status", create_type=False),
                  nullable=False, server_default="pending"),
        sa.Column("decided_by", _uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decision_note", sa.Text(), nullable=True),
        _ts(), _uts(),
    )
    op.create_index("ix_leave_requests_employee_id", "leave_requests", ["employee_id"])
    op.create_index("ix_leave_requests_status", "leave_requests", ["status"])

    op.create_table(
        "attendance_records",
        sa.Column("id", _uuid(), **UUID_PK),
        sa.Column("employee_id", _uuid(), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("check_in", sa.DateTime(timezone=True), nullable=True),
        sa.Column("check_out", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", postgresql.ENUM(*ATTENDANCE_STATUS, name="attendance_status", create_type=False),
                  nullable=False, server_default="present"),
        _ts(), _uts(),
        sa.UniqueConstraint("employee_id", "day", name="uq_attendance_emp_day"),
    )
    op.create_index("ix_attendance_records_employee_id", "attendance_records", ["employee_id"])

    op.create_table(
        "payroll_runs",
        sa.Column("id", _uuid(), **UUID_PK),
        sa.Column("period", sa.Date(), nullable=False, unique=True),
        sa.Column("status", postgresql.ENUM(*PAYROLL_RUN_STATUS, name="payroll_run_status", create_type=False),
                  nullable=False, server_default="draft"),
        sa.Column("total_net_paise", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        _ts(), _uts(),
    )

    op.create_table(
        "payslips",
        sa.Column("id", _uuid(), **UUID_PK),
        sa.Column("run_id", _uuid(), sa.ForeignKey("payroll_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employee_id", _uuid(), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("basic_paise", sa.BigInteger(), nullable=False),
        sa.Column("allowances_paise", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("deductions_paise", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("net_paise", sa.BigInteger(), nullable=False),
        sa.Column("pdf_storage_key", sa.String(512), nullable=True),
        _ts(),
        sa.UniqueConstraint("run_id", "employee_id", name="uq_payslip_run_employee"),
    )
    op.create_index("ix_payslips_run_id", "payslips", ["run_id"])
    op.create_index("ix_payslips_employee_id", "payslips", ["employee_id"])


def downgrade() -> None:
    for t in ("payslips", "payroll_runs", "attendance_records", "leave_requests",
              "leave_balances", "leave_types", "holidays", "employees"):
        op.drop_table(t)
    for e in ("payroll_run_status", "attendance_status", "leave_status", "employee_status"):
        op.execute(f"DROP TYPE IF EXISTS {e}")
