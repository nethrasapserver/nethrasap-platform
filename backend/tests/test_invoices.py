"""Invoice PDF generation — rendering, numbering, idempotency, availability."""
from __future__ import annotations

import uuid

import pytest
from app.models.order import Order, OrderStatus
from app.services import invoices
from app.services.invoices import amount_in_words
from sqlalchemy import select

from .conftest import phone_for, signup_token

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


async def _place_cod_order(client, seeded_catalogue, ident: str) -> tuple[str, str]:
    token = await signup_token(client, phone_for(ident))
    r = await client.post(
        "/api/v1/cart/items",
        headers={"Authorization": f"Bearer {token}"},
        json={"variant_id": str(seeded_catalogue["variant"].id), "quantity": 2},
    )
    assert r.status_code == 201, r.text
    place = await client.post(
        "/api/v1/checkout/place",
        headers={"Authorization": f"Bearer {token}"},
        json={"address": ADDRESS, "payment_method": "cod", "client_request_id": str(uuid.uuid4())},
    )
    assert place.status_code == 201, place.text
    return place.json()["order_number"], token


def test_amount_in_words():
    assert amount_in_words(0) == "Rupees Zero Only"
    assert amount_in_words(100) == "Rupees One Only"
    assert amount_in_words(4550) == "Rupees Forty Five and Fifty Paise Only"
    assert amount_in_words(123_456_789_00) == (
        "Rupees Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine Only"
    )
    assert amount_in_words(1_00_000_00) == "Rupees One Lakh Only"


@pytest.mark.asyncio
async def test_generate_renders_pdf_and_is_idempotent(client, db_session, seeded_catalogue):
    order_number, _ = await _place_cod_order(client, seeded_catalogue, "invoice-gen")

    key = await invoices.generate_for_order(db_session, order_number)
    assert key is not None and key.startswith("invoices/")

    order = (
        await db_session.execute(select(Order).where(Order.order_number == order_number))
    ).scalar_one()
    await db_session.refresh(order, ["invoice", "items"])
    assert order.invoice is not None
    assert order.invoice.invoice_number.startswith("INV-")
    assert order.invoice.pdf_storage_key == key
    assert order.invoice.issued_at is not None

    # Second call returns the same key without re-rendering.
    assert await invoices.generate_for_order(db_session, order_number) == key

    # The rendered bytes are a real PDF with the tax-inclusive maths intact.
    seller = await invoices._seller_identity(db_session)
    pdf = invoices._render_pdf(order, order.invoice.invoice_number, seller)
    assert pdf.startswith(b"%PDF")
    assert len(pdf) > 1200
    # Tax-inclusive invariant the layout relies on: gst sits *within* the
    # line total, so the derived taxable value is always non-negative.
    for it in order.items:
        assert it.line_total == it.quantity * it.unit_price
        assert 0 <= it.gst_amount < it.line_total or it.line_total == 0


@pytest.mark.asyncio
async def test_invoice_endpoint_gates_on_dispatch(client, db_session, seeded_catalogue):
    order_number, token = await _place_cod_order(client, seeded_catalogue, "invoice-gate")
    headers = {"Authorization": f"Bearer {token}"}

    # A freshly placed unpaid COD order documents no sale yet — no invoice.
    r = await client.get(f"/api/v1/orders/{order_number}/invoice", headers=headers)
    assert r.status_code == 404

    order = (
        await db_session.execute(select(Order).where(Order.order_number == order_number))
    ).scalar_one()
    order.status = OrderStatus.dispatched
    await db_session.commit()

    # Once dispatched, the endpoint lazily generates and returns a URL.
    r = await client.get(f"/api/v1/orders/{order_number}/invoice", headers=headers)
    assert r.status_code == 200, r.text
    assert "url" in r.json()
