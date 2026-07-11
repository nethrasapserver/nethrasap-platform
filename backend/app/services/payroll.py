"""Payroll — run a month, compute per-employee net pay, render payslip PDFs.

A run is idempotent per period: the payslip rows are created in the run
transaction; the PDFs are rendered off the request path (arq worker) and
uploaded to R2, then the employee is notified.
"""
from __future__ import annotations

import io
import uuid
from datetime import UTC, date, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..integrations import sms, storage
from ..logging import get_logger
from ..models.audit import AuditLog
from ..models.hr import Employee, EmployeeStatus, PayrollRun, PayrollRunStatus, Payslip
from ..models.user import User

log = get_logger("services.payroll")


def _rupees(paise: int) -> str:
    return f"Rs {paise / 100:,.2f}"


async def run_payroll(db: AsyncSession, actor: User, *, period: date) -> dict[str, Any]:
    """Create (or return) the payroll run for `period` and its payslips."""
    period = date(period.year, period.month, 1)
    existing = (
        await db.execute(
            select(PayrollRun).options(selectinload(PayrollRun.payslips)).where(PayrollRun.period == period)
        )
    ).scalar_one_or_none()
    if existing is not None and existing.status == PayrollRunStatus.processed:
        raise HTTPException(status.HTTP_409_CONFLICT, "payroll already processed for this period")

    run = existing or PayrollRun(period=period)
    if existing is None:
        db.add(run)
        await db.flush()

    employees = (
        await db.execute(select(Employee).where(Employee.status != EmployeeStatus.terminated))
    ).scalars().all()

    total = 0
    slip_ids: list[uuid.UUID] = []
    for emp in employees:
        basic = emp.basic_salary
        allowances = emp.allowances
        # Statutory deductions: 12% PF on basic (simplified, India-style).
        deductions = int(round(basic * 0.12))
        net = basic + allowances - deductions
        total += net
        slip = Payslip(
            run_id=run.id, employee_id=emp.id, basic_paise=basic,
            allowances_paise=allowances, deductions_paise=deductions, net_paise=net,
        )
        db.add(slip)
        await db.flush()
        slip_ids.append(slip.id)

    run.total_net_paise = total
    run.status = PayrollRunStatus.processed
    run.processed_at = datetime.now(UTC)
    db.add(AuditLog(actor_user_id=actor.id, action="hr.payroll_run", entity_type="payroll_run",
                    entity_id=str(run.id), payload={"period": period.isoformat(), "net": total,
                                                    "employees": len(employees)}))
    await db.commit()

    # Kick off PDF generation off the request path.
    from ..worker import enqueue_job
    await enqueue_job("generate_payslips", run_id=str(run.id))

    log.info("hr.payroll_run", period=period.isoformat(), employees=len(employees), net=total)
    return {"run_id": run.id, "period": period.isoformat(), "total_net_paise": total,
            "payslips": len(slip_ids), "status": run.status.value}


async def generate_payslip_pdfs(db: AsyncSession, run_id: uuid.UUID) -> int:
    """Render + store PDFs for every payslip in a run. Idempotent per slip."""
    run = (
        await db.execute(
            select(PayrollRun).options(selectinload(PayrollRun.payslips)).where(PayrollRun.id == run_id)
        )
    ).scalar_one_or_none()
    if run is None:
        return 0
    generated = 0
    for slip in run.payslips:
        if slip.pdf_storage_key:
            continue
        emp = (await db.execute(select(Employee).where(Employee.id == slip.employee_id))).scalar_one()
        pdf = _render_payslip(emp, slip, run.period)
        key = storage.make_key("payslips", content_type="application/pdf", prefix=emp.code)
        storage.put_bytes(key, pdf, content_type="application/pdf")
        slip.pdf_storage_key = key
        generated += 1
        if emp.phone:
            sms.send_sms(to=emp.phone, body=f"Nethrasap: your payslip for {run.period:%b %Y} is ready.")
    await db.commit()
    return generated


async def get_payslip_url(db: AsyncSession, user: User, *, payslip_id: uuid.UUID, is_hr: bool) -> dict[str, Any]:
    slip = (await db.execute(select(Payslip).where(Payslip.id == payslip_id))).scalar_one_or_none()
    if slip is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "payslip not found")
    emp = (await db.execute(select(Employee).where(Employee.id == slip.employee_id))).scalar_one()
    if not is_hr and emp.user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not your payslip")
    if slip.pdf_storage_key is None:
        await generate_payslip_pdfs(db, slip.run_id)
        slip = (await db.execute(select(Payslip).where(Payslip.id == payslip_id))).scalar_one()
    return {"url": storage.presigned_get(slip.pdf_storage_key or ""), "net_paise": slip.net_paise}


async def list_my_payslips(db: AsyncSession, *, employee_id: uuid.UUID) -> list[dict[str, Any]]:
    rows = (
        await db.execute(
            select(Payslip).where(Payslip.employee_id == employee_id).order_by(Payslip.created_at.desc())
        )
    ).scalars()
    return [
        {"id": s.id, "net_paise": s.net_paise, "basic_paise": s.basic_paise,
         "allowances_paise": s.allowances_paise, "deductions_paise": s.deductions_paise,
         "has_pdf": s.pdf_storage_key is not None}
        for s in rows
    ]


def _render_payslip(emp: Employee, slip: Payslip, period: date) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    y = h - 25 * mm
    c.setFont("Helvetica-Bold", 16)
    c.drawString(20 * mm, y, "Nethrasap — Payslip")
    c.setFont("Helvetica", 10)
    c.drawString(20 * mm, y - 8 * mm, f"Pay period: {period:%B %Y}")
    c.drawString(20 * mm, y - 14 * mm, f"{emp.full_name} ({emp.code}) — {emp.designation}, {emp.department}")

    y -= 30 * mm
    c.setFont("Helvetica", 11)
    for label, val in [
        ("Basic", slip.basic_paise),
        ("Allowances", slip.allowances_paise),
        ("Deductions (PF 12%)", -slip.deductions_paise),
    ]:
        c.drawString(25 * mm, y, label)
        c.drawRightString(w - 25 * mm, y, _rupees(val))
        y -= 8 * mm
    c.line(25 * mm, y, w - 25 * mm, y)
    y -= 8 * mm
    c.setFont("Helvetica-Bold", 12)
    c.drawString(25 * mm, y, "Net Pay")
    c.drawRightString(w - 25 * mm, y, _rupees(slip.net_paise))

    c.setFont("Helvetica", 7)
    c.drawString(20 * mm, 15 * mm, "Computer-generated payslip. No signature required.")
    c.showPage()
    c.save()
    return buf.getvalue()
