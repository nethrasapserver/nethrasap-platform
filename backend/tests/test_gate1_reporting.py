"""Gate 1 remediation — invoice compliance + analytics accuracy.

Covers two confirmed production defects:

* H-10 — top-products revenue double-counted GST. `line_total` is already
  tax-inclusive (GST sits *within* it), so revenue per product must be
  ``sum(line_total)`` alone, not ``line_total + gst_amount``.
* H-9 (presentation half) — the tax invoice was not a valid Indian tax
  invoice: no GSTIN and no CGST/SGST split. The invoice consumes the stored
  order values (the tax *base* is owned by checkout/pricing) and only presents
  the seller GSTIN plus a half/half CGST/SGST split of the stored gst_total.
"""
from __future__ import annotations

import re
import uuid
import zlib

import pytest
import reportlab.rl_config
from app.models.order import Order, OrderItem
from app.services import analytics, invoices
from sqlalchemy import func, select

# Render invoices uncompressed IN TESTS ONLY so drawn text is greppable without
# a PDF library (production keeps the default compression). reportlab's canvas
# reads this global when pageCompression isn't passed explicitly.
reportlab.rl_config.pageCompression = 0

from .conftest import auth, phone_for, signup_token

ADDRESS = {
    "full_name": "Test Buyer",
    "phone": "9876543210",
    "line1": "10 Main Road",
    "line2": None,
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "country": "IN",
}

GSTIN = "33ABCDE1234F1Z5"


async def _place_cod_order(client, seeded_catalogue, ident: str, qty: int = 2) -> str:
    """Place one confirmed COD order and return its order_number."""
    token = await signup_token(client, phone_for(ident))
    r = await client.post(
        "/api/v1/cart/items",
        headers=auth(token),
        json={"variant_id": str(seeded_catalogue["variant"].id), "quantity": qty},
    )
    assert r.status_code == 201, r.text
    place = await client.post(
        "/api/v1/checkout/place",
        headers=auth(token),
        json={"address": ADDRESS, "payment_method": "cod", "client_request_id": str(uuid.uuid4())},
    )
    assert place.status_code == 201, place.text
    return place.json()["order_number"]


def _pdf_text(pdf: bytes) -> str:
    """Best-effort extraction of drawn text — inflate flate streams if present,
    otherwise read the (uncompressed) content stream directly."""
    parts: list[str] = []
    for m in re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", pdf, re.DOTALL):
        raw = m.group(1)
        try:
            parts.append(zlib.decompress(raw).decode("latin-1"))
        except Exception:
            parts.append(raw.decode("latin-1", "ignore"))
    parts.append(pdf.decode("latin-1", "ignore"))
    return "\n".join(parts)


# --- H-10: top-products revenue is sum(line_total), not line_total + gst ------


@pytest.mark.asyncio
async def test_top_products_revenue_excludes_double_counted_gst(
    client, db_session, seeded_catalogue
):
    order_number = await _place_cod_order(client, seeded_catalogue, "gate1-tp", qty=2)

    order = (
        await db_session.execute(select(Order).where(Order.order_number == order_number))
    ).scalar_one()
    await db_session.refresh(order, ["items"])

    expected_line_total = sum(it.line_total for it in order.items)
    total_gst = sum(it.gst_amount for it in order.items)
    double_counted = expected_line_total + total_gst

    # Guard: the seed carries real GST so the two figures genuinely differ.
    assert total_gst > 0, "seed order must carry GST for this test to be meaningful"

    # Matches a direct SQL sum of the tax-inclusive column.
    db_sum = (
        await db_session.execute(select(func.sum(OrderItem.line_total)))
    ).scalar_one()
    assert int(db_sum) == expected_line_total

    rows = await analytics.top_products(db_session, days=30, limit=10)
    row = next(r for r in rows if r["product_name"] == "Amoxicillin 500mg Capsules")

    assert row["revenue_paise"] == expected_line_total
    assert row["revenue_paise"] != double_counted


# --- H-9: invoice is a valid tax invoice (GSTIN + CGST/SGST split) ------------


@pytest.mark.asyncio
async def test_invoice_renders_gstin_and_cgst_sgst_split(
    client, db_session, seeded_catalogue
):
    order_number = await _place_cod_order(client, seeded_catalogue, "gate1-inv", qty=2)
    order = (
        await db_session.execute(select(Order).where(Order.order_number == order_number))
    ).scalar_one()
    await db_session.refresh(order, ["items", "invoice"])

    seller = await invoices._seller_identity(db_session)
    seller["seller_gstin"] = GSTIN  # ops/env would supply this in production

    pdf = invoices._render_pdf(order, "INV-2026-00001", seller)

    # Existing contract: real PDF bytes.
    assert pdf.startswith(b"%PDF")

    text = _pdf_text(pdf)
    # GSTIN is printed → the document identifies the registered seller.
    assert GSTIN in text
    # Tax is presented as a CGST/SGST pair, no longer a single opaque "GST".
    assert "CGST" in text
    assert "SGST" in text

    # The two halves reconstruct the stored gst_total exactly (odd paise → SGST),
    # and the rendered rupee amounts appear in the document.
    assert order.gst_total > 0
    cgst = order.gst_total // 2
    sgst = order.gst_total - cgst
    assert cgst + sgst == order.gst_total
    assert invoices._rupees(cgst) in text
    assert invoices._rupees(sgst) in text


@pytest.mark.asyncio
async def test_invoice_omits_gstin_line_when_unset(client, db_session, seeded_catalogue):
    """With no GSTIN configured the invoice must not print a bare 'GSTIN:' label."""
    order_number = await _place_cod_order(client, seeded_catalogue, "gate1-nogst", qty=2)
    order = (
        await db_session.execute(select(Order).where(Order.order_number == order_number))
    ).scalar_one()
    await db_session.refresh(order, ["items"])

    seller = await invoices._seller_identity(db_session)
    seller["seller_gstin"] = ""

    pdf = invoices._render_pdf(order, "INV-2026-00002", seller)
    assert pdf.startswith(b"%PDF")
    assert "GSTIN:" not in _pdf_text(pdf)


@pytest.mark.asyncio
async def test_seller_gstin_sourced_from_config(db_session, monkeypatch):
    """Env-driven seller_gstin flows into the seller identity block."""
    from app import config

    monkeypatch.setenv("SELLER_GSTIN", GSTIN)
    config.get_settings.cache_clear()
    try:
        seller = await invoices._seller_identity(db_session)
        assert seller["seller_gstin"] == GSTIN
    finally:
        config.get_settings.cache_clear()
