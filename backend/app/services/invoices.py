"""Tax-invoice PDF generation.

Runs off the request path (arq worker) after a payment is captured — and for
COD orders when the shipment is marked delivered (fulfilment enqueues it).
`orders.invoice_url` also generates lazily on first download, so an invoice
is always obtainable once the order is paid/payable.

Renders a GST invoice with reportlab (pure-Python — no system libraries, so
it builds cleanly in the Docker/Render images), uploads to R2 under
`invoices/`, and records the storage key on the Invoice row.

Money maths (post migration 0012, tax-inclusive prices):
    line_total  = qty x unit_price          (what the customer pays, incl. GST)
    gst_amount  = tax back-calculated *within* line_total
    subtotal    = line_total - gst_amount   (taxable value)
The invoice therefore shows Rate/Amount tax-inclusive plus a separate taxable
value column; totals are Taxable + GST + Shipping - Discount = Grand.

Seller identity is ops-editable via app_settings keys (seller_name,
seller_tagline, seller_address, seller_gstin, seller_phone), code defaults
below.
"""
from __future__ import annotations

import io
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..integrations import storage
from ..logging import get_logger
from ..models.order import Invoice, Order

log = get_logger("services.invoices")

SELLER_DEFAULTS: dict[str, str] = {
    "seller_name": "Nethrasap",
    "seller_tagline": "India's audited healthcare supply platform",
    "seller_address": "Chennai, Tamil Nadu, India",
    "seller_gstin": "",
    "seller_phone": "",
}


def _rupees(paise: int) -> str:
    return f"Rs {paise / 100:,.2f}"


# --- Amount in words (Indian numbering — customary on tax invoices) ----------

_ONES = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
    "Eighteen", "Nineteen",
]
_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]


def _two(n: int) -> str:
    if n < 20:
        return _ONES[n]
    return (_TENS[n // 10] + (" " + _ONES[n % 10] if n % 10 else "")).strip()


def _three(n: int) -> str:
    hundreds, rest = divmod(n, 100)
    parts = []
    if hundreds:
        parts.append(f"{_ONES[hundreds]} Hundred")
    if rest:
        parts.append(_two(rest))
    return " ".join(parts)


def amount_in_words(paise: int) -> str:
    rupees, p = divmod(max(0, paise), 100)
    if rupees == 0:
        words = "Zero"
    else:
        crore, rest = divmod(rupees, 10_000_000)
        lakh, rest = divmod(rest, 100_000)
        thousand, rest = divmod(rest, 1_000)
        parts = []
        if crore:
            parts.append(f"{_three(crore)} Crore" if crore >= 100 else f"{_two(crore)} Crore")
        if lakh:
            parts.append(f"{_two(lakh)} Lakh")
        if thousand:
            parts.append(f"{_two(thousand)} Thousand")
        if rest:
            parts.append(_three(rest))
        words = " ".join(parts)
    tail = f" and {_two(p)} Paise" if p else ""
    return f"Rupees {words}{tail} Only"


async def _next_invoice_number(db: AsyncSession) -> str:
    year = datetime.now(UTC).year
    prefix = f"INV-{year}-"
    count = (
        await db.execute(select(func.count(Invoice.id)).where(Invoice.invoice_number.like(f"{prefix}%")))
    ).scalar_one()
    return f"{prefix}{count + 1:05d}"


def _render_pdf(order: Order, invoice_number: str, seller: dict[str, str]) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    left = 20 * mm
    right = w - 20 * mm
    grey = colors.HexColor("#70746a")
    ink = colors.HexColor("#101208")
    line_col = colors.HexColor("#d8d9d2")

    # Right-aligned numeric column positions.
    col_hsn = 102 * mm
    col_qty = 120 * mm
    col_rate = 140 * mm
    col_taxable = 158 * mm
    col_gst = 172 * mm
    col_amount = right

    def page_header(first: bool) -> float:
        y = h - 22 * mm
        c.setFillColor(ink)
        c.setFont("Helvetica-Bold", 16 if first else 11)
        c.drawString(left, y, seller["seller_name"])
        c.setFont("Helvetica-Bold", 12 if first else 10)
        c.drawRightString(right, y, "TAX INVOICE")
        c.setFont("Helvetica", 8)
        c.setFillColor(grey)
        c.drawRightString(right, y - 5 * mm, invoice_number)
        if not first:
            return y - 10 * mm

        offset = 5
        for line in (
            seller["seller_tagline"],
            seller["seller_address"],
            f"GSTIN: {seller['seller_gstin']}" if seller["seller_gstin"] else "",
            f"Phone: {seller['seller_phone']}" if seller["seller_phone"] else "",
        ):
            if line:
                c.drawString(left, y - offset * mm, line)
                offset += 4
        c.drawRightString(right, y - 9 * mm, f"Order {order.order_number}")
        c.drawRightString(right, y - 13 * mm, f"Invoice date: {datetime.now(UTC).strftime('%d %b %Y')}")
        if order.placed_at:
            c.drawRightString(right, y - 17 * mm, f"Order date: {order.placed_at.strftime('%d %b %Y')}")
        y -= (max(offset, 21) + 6) * mm

        addr = order.shipping_address or {}
        c.setFillColor(ink)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(left, y, "Bill to / Ship to")
        c.setFont("Helvetica", 8)
        offset = 5
        for line in (
            addr.get("full_name", ""),
            addr.get("line1", ""),
            addr.get("line2", ""),
            f"{addr.get('city', '')} {addr.get('state', '')} {addr.get('pincode', '')}".strip(),
            addr.get("phone", ""),
        ):
            if line:
                c.drawString(left, y - offset * mm, str(line))
                offset += 4
        return y - (offset + 4) * mm

    def table_header(y: float) -> float:
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(grey)
        c.drawString(left, y, "ITEM")
        c.drawRightString(col_hsn, y, "HSN")
        c.drawRightString(col_qty, y, "QTY")
        c.drawRightString(col_rate, y, "RATE")
        c.drawRightString(col_taxable, y, "TAXABLE")
        c.drawRightString(col_gst, y, "GST")
        c.drawRightString(col_amount, y, "AMOUNT")
        c.setStrokeColor(line_col)
        c.line(left, y - 2 * mm, right, y - 2 * mm)
        return y - 7 * mm

    def new_page() -> float:
        c.setFont("Helvetica", 7)
        c.setFillColor(grey)
        c.drawRightString(right, 12 * mm, f"Continued · page {c.getPageNumber()}")
        c.showPage()
        return table_header(page_header(first=False))

    y = table_header(page_header(first=True))

    for it in order.items:
        if y < 50 * mm:
            y = new_page()
        c.setFillColor(ink)
        c.setFont("Helvetica", 8)
        c.drawString(left, y, (it.product_name_snapshot or "")[:44])
        c.drawRightString(col_hsn, y, it.hsn_code_snapshot or "-")
        c.drawRightString(col_qty, y, str(it.quantity))
        c.drawRightString(col_rate, y, f"{it.unit_price / 100:,.2f}")
        # Taxable value is derived: the stored line_total is tax-inclusive.
        c.drawRightString(col_taxable, y, f"{(it.line_total - it.gst_amount) / 100:,.2f}")
        c.drawRightString(col_gst, y, f"{it.gst_amount / 100:,.2f}")
        # line_total is tax-inclusive — the GST is already inside it.
        c.drawRightString(col_amount, y, f"{it.line_total / 100:,.2f}")
        c.setFont("Helvetica", 6.5)
        c.setFillColor(grey)
        c.drawString(left, y - 3.4 * mm, f"{it.unit_label_snapshot or ''} · GST {it.gst_rate_pct}%")
        y -= 9 * mm

    if y < 80 * mm:
        y = new_page()

    y -= 2 * mm
    c.setStrokeColor(line_col)
    c.line(120 * mm, y, right, y)
    y -= 6 * mm
    c.setFont("Helvetica", 9)
    c.setFillColor(ink)
    total_rows: list[tuple[str, int]] = [("Taxable value", order.subtotal)]
    if order.discount_total:
        total_rows.append(("Discount", -order.discount_total))
    # Split the stored GST into a CGST/SGST pair — the correct presentation for
    # an intra-state supply, which is the only case for the single-state seed.
    # Place-of-supply isn't modelled yet, so we always assume intra-state and
    # split half/half; the two halves sum back to the exact stored gst_total
    # (odd paise land on SGST). Switch to a single IGST row once inter-state
    # place-of-supply is available. We render whatever gst_total the order
    # already carries — the tax *base* is owned by checkout/pricing.
    cgst = order.gst_total // 2
    sgst = order.gst_total - cgst
    total_rows.append(("CGST", cgst))
    total_rows.append(("SGST", sgst))
    total_rows.append(("Shipping", order.shipping_total))
    for label, val in total_rows:
        c.drawString(120 * mm, y, label)
        c.drawRightString(right, y, _rupees(val))
        y -= 5.5 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(120 * mm, y, "Grand total")
    c.drawRightString(right, y, _rupees(order.grand_total))
    y -= 6 * mm
    c.setFont("Helvetica-Oblique", 7.5)
    c.setFillColor(grey)
    c.drawRightString(right, y, amount_in_words(order.grand_total))

    y -= 16 * mm
    c.setFont("Helvetica", 8)
    c.setFillColor(ink)
    c.drawRightString(right, y, f"For {seller['seller_name']}")
    c.setFont("Helvetica", 7)
    c.setFillColor(grey)
    c.drawRightString(right, y - 10 * mm, "Authorised signatory")

    c.setFont("Helvetica", 7)
    c.setFillColor(grey)
    c.drawString(left, 12 * mm, "This is a computer-generated invoice. Prices are inclusive of GST.")
    c.drawRightString(right, 12 * mm, f"Page {c.getPageNumber()}")
    c.showPage()
    c.save()
    return buf.getvalue()


async def _seller_identity(db: AsyncSession) -> dict[str, str]:
    """Seller block for the tax invoice.

    Layering (most specific wins): ops-editable `app_settings` key >
    env-driven config (currently only `seller_gstin`) > code default.
    """
    from ..config import get_settings
    from . import cms

    defaults = dict(SELLER_DEFAULTS)
    # Env-configured GSTIN is the compliance-critical field; let it fill the
    # default so a deployment can set it without touching app_settings.
    if get_settings().seller_gstin:
        defaults["seller_gstin"] = get_settings().seller_gstin

    try:
        settings_map: dict[str, Any] = await cms.get_settings_map(db)
    except Exception:  # pragma: no cover — identity is decoration, never fatal
        settings_map = {}
    return {key: str(settings_map.get(key) or default) for key, default in defaults.items()}


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

    seller = await _seller_identity(db)
    pdf = _render_pdf(order, invoice.invoice_number, seller)
    key = storage.make_key("invoices", content_type="application/pdf", prefix=invoice.invoice_number)
    await storage.put_bytes_async(key, pdf, content_type="application/pdf")
    invoice.pdf_storage_key = key
    invoice.issued_at = datetime.now(UTC)
    await db.commit()
    log.info("invoice.generated", order_number=order_number, invoice_number=invoice.invoice_number)
    return key
