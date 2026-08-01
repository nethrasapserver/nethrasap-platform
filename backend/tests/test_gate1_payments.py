"""Gate 1 — payment/refund concurrency remediation.

The pytest harness can't easily drive true parallelism, so these tests pin the
*logic* the concurrency fixes rely on; the lead runs real parallel-curl races
separately. Covers:

  * CR-1  — a refund exceeding the remaining balance is rejected (fulfilment).
  * H-14  — apply_captured is idempotent: a replay adds no duplicate
            status-history / outbox rows.
  * H-3   — the cancel refund path is awaited (no coroutine leak) and issues a
            single gateway refund returning a dict with an id.
"""
from __future__ import annotations

import json
import uuid

import pytest
from app.integrations.razorpay import stub_checkout_signature
from app.models.order import OrderStatus, OrderStatusHistory, Refund
from app.models.outbox import JobOutbox
from sqlalchemy import func, select

from .conftest import auth, phone_for, signup_token

ADDRESS = {
    "full_name": "Test Buyer",
    "phone": "9876543210",
    "line1": "10 Main Road",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "country": "IN",
}


async def _place_online(client, token, variant_id, qty=1):
    await client.post(
        "/api/v1/cart/items", headers=auth(token), json={"variant_id": str(variant_id), "quantity": qty}
    )
    r = await client.post(
        "/api/v1/checkout/place",
        headers=auth(token),
        json={"address": ADDRESS, "payment_method": "upi", "client_request_id": str(uuid.uuid4())},
    )
    assert r.status_code == 201, r.text
    return r.json()


async def _capture_via_confirm(client, gateway_order_id):
    payment_id = "pay_" + uuid.uuid4().hex[:12]
    sig = stub_checkout_signature(order_id=gateway_order_id, payment_id=payment_id)
    r = await client.post(
        "/api/v1/checkout/confirm",
        json={
            "razorpay_order_id": gateway_order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": sig,
        },
    )
    assert r.status_code == 200, r.text
    return r.json()


# --- CR-1: refund bound is enforced ------------------------------------------


@pytest.mark.asyncio
async def test_refund_over_remaining_balance_rejected(client, seeded_catalogue, staff_tokens):
    """After a partial refund, a second refund that exceeds the remaining
    balance must be rejected — the in-lock recompute bounds every refund."""
    admin = staff_tokens["admin"]
    token = await signup_token(client, phone_for("gate1-refund"))
    body = await _place_online(client, token, seeded_catalogue["variant"].id, qty=1)
    await _capture_via_confirm(client, body["gateway"]["gateway_order_id"])
    on = body["order_number"]
    total = body["grand_total"]

    # Partial refund of half.
    r = await client.post(
        f"/api/v1/admin/orders/{on}/refund",
        headers=auth(admin),
        json={"amount_paise": total // 2, "reason": "goodwill"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["payment_status"] == "partial_refund"

    # Now ask for MORE than what remains → must be rejected (bound enforced).
    over = total  # far more than the remaining half
    r = await client.post(
        f"/api/v1/admin/orders/{on}/refund",
        headers=auth(admin),
        json={"amount_paise": over},
    )
    assert r.status_code == 400, r.text
    assert "refund amount must be" in r.text


# --- H-14: capture idempotency (no duplicate rows) ---------------------------


@pytest.mark.asyncio
async def test_apply_captured_idempotent_no_duplicate_rows(client, db_session, seeded_catalogue):
    """A replayed capture webhook must no-op: exactly one confirmed
    status-history row and one invoice outbox row for the order."""
    token = await signup_token(client, phone_for("gate1-idem"))
    body = await _place_online(client, token, seeded_catalogue["variant"].id)
    order_id = body["gateway"]["gateway_order_id"]
    on = body["order_number"]

    payload = {
        "event": "payment.captured",
        "payload": {"payment": {"entity": {"id": "pay_gate1", "order_id": order_id}}},
    }
    raw = json.dumps(payload)

    r1 = await client.post(
        "/api/v1/payments/webhook", content=raw, headers={"content-type": "application/json"}
    )
    assert r1.status_code == 200, r1.text
    assert r1.json()["processed"] is True

    # Replay the identical event twice more.
    for _ in range(2):
        r = await client.post(
            "/api/v1/payments/webhook", content=raw, headers={"content-type": "application/json"}
        )
        assert r.status_code == 200, r.text
        assert r.json()["processed"] is False

    # Resolve the order id from its number, then count the side-effect rows.
    from app.models.order import Order

    order_uuid = (
        await db_session.execute(select(Order.id).where(Order.order_number == on))
    ).scalar_one()

    confirmed_rows = (
        await db_session.execute(
            select(func.count())
            .select_from(OrderStatusHistory)
            .where(
                OrderStatusHistory.order_id == order_uuid,
                OrderStatusHistory.status == OrderStatus.confirmed,
            )
        )
    ).scalar_one()
    assert confirmed_rows == 1, f"expected 1 confirmed history row, got {confirmed_rows}"

    outbox_rows = (
        await db_session.execute(
            select(JobOutbox).where(JobOutbox.task_name == "generate_invoice_pdf")
        )
    ).scalars().all()
    matching = [j for j in outbox_rows if (j.payload or {}).get("order_number") == on]
    assert len(matching) == 1, f"expected 1 invoice outbox row, got {len(matching)}"


# --- H-3: cancel refund path awaits and issues one refund --------------------


@pytest.mark.asyncio
async def test_cancel_refund_path_awaits(client, db_session, seeded_catalogue):
    """cancel_order on a captured order must refund exactly once. If the refund
    call were not awaited, refund_resp['id'] would raise TypeError (500) and no
    Refund row would land; a 200 + a single refund row proves the await."""
    token = await signup_token(client, phone_for("gate1-cancel"))
    body = await _place_online(client, token, seeded_catalogue["variant"].id, qty=1)
    await _capture_via_confirm(client, body["gateway"]["gateway_order_id"])
    on = body["order_number"]

    r = await client.post(
        f"/api/v1/orders/{on}/cancel",
        headers=auth(token),
        json={"reason": "changed my mind"},
    )
    assert r.status_code == 200, r.text
    detail = r.json()
    assert detail["status"] == "cancelled"
    assert detail["payment_status"] == "refunded"

    # Exactly one refund row, and it carries a gateway refund id (dict was
    # returned and indexed — proving the coroutine was awaited).
    from app.models.order import Order, Payment

    payment_id = (
        await db_session.execute(
            select(Payment.id)
            .join(Order, Order.id == Payment.order_id)
            .where(Order.order_number == on)
        )
    ).scalar_one()
    refunds = (
        await db_session.execute(select(Refund).where(Refund.payment_id == payment_id))
    ).scalars().all()
    assert len(refunds) == 1, f"expected exactly 1 refund, got {len(refunds)}"
    assert refunds[0].gateway_refund_id, "refund is missing its gateway id"
    assert refunds[0].amount == body["grand_total"]
