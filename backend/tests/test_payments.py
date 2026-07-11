"""B4 — gateway confirmation (client + webhook), invoice, dispatch fulfilment,
delivery walk, refunds, and permission gates. All on the Razorpay stub."""
from __future__ import annotations

import json
import uuid

import pytest
from app.integrations.razorpay import stub_checkout_signature

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
    """Place a non-COD (upi) order; returns the place response JSON."""
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


async def _receive(client, admin, variant_id, qty):
    r = await client.post(
        "/api/v1/admin/inventory/receive",
        headers=auth(admin),
        json={"variant_id": str(variant_id), "quantity": qty},
    )
    assert r.status_code == 201, r.text


@pytest.mark.asyncio
async def test_place_online_returns_gateway_handshake(client, seeded_catalogue):
    token = await signup_token(client, phone_for("pay-1"))
    body = await _place_online(client, token, seeded_catalogue["variant"].id)
    assert body["status"] == "placed"
    assert body["payment_status"] == "pending"
    gw = body["gateway"]
    assert gw["gateway_order_id"].startswith("order_stub_")
    assert gw["amount"] == body["grand_total"]


@pytest.mark.asyncio
async def test_client_confirm_captures_order(client, seeded_catalogue):
    token = await signup_token(client, phone_for("pay-2"))
    body = await _place_online(client, token, seeded_catalogue["variant"].id)
    order_id = body["gateway"]["gateway_order_id"]
    payment_id = "pay_" + uuid.uuid4().hex[:12]
    sig = stub_checkout_signature(order_id=order_id, payment_id=payment_id)

    r = await client.post(
        "/api/v1/checkout/confirm",
        json={"razorpay_order_id": order_id, "razorpay_payment_id": payment_id, "razorpay_signature": sig},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "confirmed"

    detail = await client.get(f"/api/v1/orders/{body['order_number']}", headers=auth(token))
    assert detail.json()["payment_status"] == "captured"


@pytest.mark.asyncio
async def test_confirm_rejects_bad_signature(client, seeded_catalogue):
    token = await signup_token(client, phone_for("pay-3"))
    body = await _place_online(client, token, seeded_catalogue["variant"].id)
    r = await client.post(
        "/api/v1/checkout/confirm",
        json={
            "razorpay_order_id": body["gateway"]["gateway_order_id"],
            "razorpay_payment_id": "pay_wrongid",
            "razorpay_signature": "deadbeef00",
        },
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_webhook_capture_idempotent(client, seeded_catalogue):
    token = await signup_token(client, phone_for("pay-4"))
    body = await _place_online(client, token, seeded_catalogue["variant"].id)
    order_id = body["gateway"]["gateway_order_id"]
    payload = {
        "event": "payment.captured",
        "payload": {"payment": {"entity": {"id": "pay_hook1", "order_id": order_id}}},
    }
    raw = json.dumps(payload)

    # No webhook secret in test env → signature check skipped (dev tolerance).
    r1 = await client.post("/api/v1/payments/webhook", content=raw, headers={"content-type": "application/json"})
    assert r1.status_code == 200, r1.text
    assert r1.json()["processed"] is True
    # Replaying the same event is a no-op.
    r2 = await client.post("/api/v1/payments/webhook", content=raw, headers={"content-type": "application/json"})
    assert r2.json()["processed"] is False


@pytest.mark.asyncio
async def test_webhook_failure_releases_stock(client, seeded_catalogue, staff_tokens):
    admin = staff_tokens["admin"]
    vid = seeded_catalogue["variant"].id
    await _receive(client, admin, vid, 5)

    token = await signup_token(client, phone_for("pay-5"))
    body = await _place_online(client, token, vid, qty=3)
    # Reserved 3 of 5.
    inv = await client.get("/api/v1/admin/inventory", headers=auth(admin))
    assert next(x for x in inv.json() if x["variant_id"] == str(vid))["available"] == 2

    payload = {
        "event": "payment.failed",
        "payload": {"payment": {"entity": {"id": "pay_fail", "order_id": body["gateway"]["gateway_order_id"]}}},
    }
    r = await client.post(
        "/api/v1/payments/webhook", content=json.dumps(payload), headers={"content-type": "application/json"}
    )
    assert r.status_code == 200

    # Stock released; order failed.
    inv = await client.get("/api/v1/admin/inventory", headers=auth(admin))
    assert next(x for x in inv.json() if x["variant_id"] == str(vid))["available"] == 5
    detail = await client.get(f"/api/v1/orders/{body['order_number']}", headers=auth(token))
    assert detail.json()["status"] == "payment_failed"


@pytest.mark.asyncio
async def test_invoice_download(client, seeded_catalogue):
    token = await signup_token(client, phone_for("pay-6"))
    body = await _place_online(client, token, seeded_catalogue["variant"].id)
    order_id = body["gateway"]["gateway_order_id"]
    payment_id = "pay_" + uuid.uuid4().hex[:12]
    await client.post(
        "/api/v1/checkout/confirm",
        json={
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": stub_checkout_signature(order_id=order_id, payment_id=payment_id),
        },
    )
    inv = await client.get(f"/api/v1/orders/{body['order_number']}/invoice", headers=auth(token))
    assert inv.status_code == 200, inv.text
    assert inv.json()["url"]  # presigned (stub) URL


@pytest.mark.asyncio
async def test_dispatch_fulfils_stock_and_walks_to_delivered(client, seeded_catalogue, staff_tokens):
    admin = staff_tokens["admin"]
    vid = seeded_catalogue["variant"].id
    await _receive(client, admin, vid, 10)

    token = await signup_token(client, phone_for("pay-7"))
    body = await _place_online(client, token, vid, qty=4)
    order_id = body["gateway"]["gateway_order_id"]
    payment_id = "pay_" + uuid.uuid4().hex[:12]
    await client.post(
        "/api/v1/checkout/confirm",
        json={
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": stub_checkout_signature(order_id=order_id, payment_id=payment_id),
        },
    )
    on = body["order_number"]

    # Dispatch → on_hand drops from 10 to 6, reserved back to 0.
    ship = await client.post(
        f"/api/v1/admin/orders/{on}/shipment",
        headers=auth(admin),
        json={"courier": "Delhivery", "awb_number": "DL123456"},
    )
    assert ship.status_code == 200, ship.text
    assert ship.json()["status"] == "dispatched"
    inv = await client.get("/api/v1/admin/inventory", headers=auth(admin))
    row = next(x for x in inv.json() if x["variant_id"] == str(vid))
    assert row["on_hand"] == 6 and row["reserved"] == 0 and row["available"] == 6

    # Walk to delivered.
    deliver = await client.patch(
        f"/api/v1/admin/orders/{on}/shipment", headers=auth(admin), json={"status": "delivered"}
    )
    assert deliver.status_code == 200
    assert deliver.json()["status"] == "delivered"


@pytest.mark.asyncio
async def test_fulfil_requires_permission(client, seeded_catalogue):
    customer = await signup_token(client, phone_for("pay-8"))
    r = await client.post(
        "/api/v1/admin/orders/NS-2026-00001/shipment",
        headers=auth(customer),
        json={"courier": "X", "awb_number": "Y"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_refund_full_and_partial(client, seeded_catalogue, staff_tokens):
    admin = staff_tokens["admin"]
    token = await signup_token(client, phone_for("pay-9"))
    body = await _place_online(client, token, seeded_catalogue["variant"].id, qty=1)
    order_id = body["gateway"]["gateway_order_id"]
    payment_id = "pay_" + uuid.uuid4().hex[:12]
    await client.post(
        "/api/v1/checkout/confirm",
        json={
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": stub_checkout_signature(order_id=order_id, payment_id=payment_id),
        },
    )
    on = body["order_number"]
    total = body["grand_total"]

    # Partial refund first.
    r = await client.post(
        f"/api/v1/admin/orders/{on}/refund", headers=auth(admin), json={"amount_paise": total // 2, "reason": "goodwill"}
    )
    assert r.status_code == 200, r.text
    assert r.json()["payment_status"] == "partial_refund"

    # Remaining refund → full.
    r = await client.post(f"/api/v1/admin/orders/{on}/refund", headers=auth(admin), json={})
    assert r.status_code == 200
    assert r.json()["status"] == "refunded"

    # Over-refund now rejected.
    r = await client.post(
        f"/api/v1/admin/orders/{on}/refund", headers=auth(admin), json={"amount_paise": 100}
    )
    assert r.status_code in (400, 409)


@pytest.mark.asyncio
async def test_refund_requires_permission(client, seeded_catalogue, staff_tokens):
    # sales has fulfil but NOT refund.
    r = await client.post(
        "/api/v1/admin/orders/NS-2026-00001/refund", headers=auth(staff_tokens["sales"]), json={}
    )
    assert r.status_code == 403
