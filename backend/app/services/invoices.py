"""Tax-invoice PDF generation.

Runs off the request path (arq worker) after a payment is captured. Renders a
GST invoice with reportlab (pure-Python — no system libraries, so it builds
cleanly in the Docker/Render images), uploads to R2 under `invoices/`, and
records the storage key on the Invoice row.
"""
from __future__ import annotations

import io
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..integrations import storage
from ..logging import get_logger
from ..models.order import Invoice, Order

log = get_logger("services.invoices")


def _rupees(paise: int) -> str:
    return f"Rs {paise / 100:,.2f}"


async def _next_invoice_number(db: AsyncSession) -> str:
    year = datetime.now(UTC).year
    prefix = f"INV-{year}-"
    count = (
        await db.execute(select(func.count(Invoice.id)).where(Invoice.invoice_number.like(f"{prefix}%")))
    ).scalar_one()
    return f"{prefix}{count + 1:05d}"


def _render_pdf(order: Order, invoice_number: str) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    y = h - 25 * mm

    c.setFont("Helvetica-Bold", 18)
    c.drawString(20 * mm, y, "Nethrasap")
    c.setFont("Helvetica", 9)
    c.drawString(20 * mm, y - 6 * mm, "India's audited healthcare supply platform")
    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(w - 20 * mm, y, "TAX INVOICE")
    c.setFont("Helvetica", 9)
    c.drawRightString(w - 20 * mm, y - 6 * mm, invoice_number)
    c.drawRightString(w - 20 * mm, y - 11 * mm, f"Order {order.order_number}")

    y -= 24 * mm
    addr = order.shipping_address or {}
    c.setFont("Helvetica-Bold", 10)
    c.drawString(20 * mm, y, "Bill to")
    c.setFont("Helvetica", 9)
    for i, line in enumerate(
        [addr.get("full_name", ""), addr.get("line1", ""),
         f"{addr.get('city', '')} {addr.get('state', '')} {addr.get('pincode', '')}".strip(),
         addr.get("phone", "")]
    ):
        if line:
            c.drawString(20 * mm, y - (5 + i * 4.5) * mm, str(line))

    y -= 34 * mm
    c.setFont("Helvetica-Bold", 8)
    cols = [(20, "Item"), (110, "Qty"), (128, "Rate"), (150, "GST"), (172, "Amount")]
    for x, label in cols:
        c.drawString(x * mm, y, label)
    c.line(20 * mm, y - 2 * mm, w - 20 * mm, y - 2 * mm)
    y -= 7 * mm

    c.setFont("Helvetica", 8)
    for it in order.items:
        c.drawString(20 * mm, y, (it.product_name_snapshot or "")[:48])
        c.drawString(110 * mm, y, str(it.quantity))
        c.drawString(128 * mm, y, _rupees(it.unit_price))
        c.drawString(150 * mm, y, f"{it.gst_rate_pct}%")
        c.drawRightString(w - 20 * mm, y, _rupees(it.line_total + it.gst_amount))
        y -= 5.5 * mm

    y -= 4 * mm
    c.line(120 * mm, y, w - 20 * mm, y)
    y -= 6 * mm
    c.setFont("Helvetica", 9)
    for label, val in [
        ("Subtotal", order.subtotal),
        ("Discount", -order.discount_total),
        ("GST", order.gst_total),
        ("Shipping", order.shipping_total),
    ]:
        c.drawString(120 * mm, y, label)
        c.drawRightString(w - 20 * mm, y, _rupees(val))
        y -= 5 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(120 * mm, y, "Grand Total")
    c.drawRightString(w - 20 * mm, y, _rupees(order.grand_total))

    c.setFont("Helvetica", 7)
    c.setFillColor(colors.grey)
    c.drawString(20 * mm, 15 * mm, "This is a computer-generated invoice.")
    c.showPage()
    c.save()
    return buf.getvalue()


async def generate_for_order(db: AsyncSession, order_number: str) -> str | None:
    """Render + store the invoice PDF. Idempotent: skips if already issued."""
    order = (
        await db.execute(
            select(Order)
            .options(selectinload(Order.items), selectinload(Order.invoice))
            .where(Order.order_number == order_number)
        )
    ).scalar_one_or_none()
    if order is None:
        log.warning("invoice.order_missing", order_number=order_number)
        return None

    invoice = order.invoice
    if invoice is None:
        invoice = Invoice(order_id=order.id, invoice_number=await _next_invoice_number(db))
        db.add(invoice)
        await db.flush()
    elif invoice.pdf_storage_key:
        return invoice.pdf_storage_key  # already generated

    if not invoice.invoice_number or invoice.invoice_number == order.order_number:
        invoice.invoice_number = await _next_invoice_number(db)

    pdf = _render_pdf(order, invoice.invoice_number)
    key = storage.make_key("invoices", content_type="application/pdf", prefix=invoice.invoice_number)
    storage.put_bytes(key, pdf, content_type="application/pdf")
    invoice.pdf_storage_key = key
    invoice.issued_at = datetime.now(UTC)
    await db.commit()
    log.info("invoice.generated", order_number=order_number, invoice_number=invoice.invoice_number)
    return key
