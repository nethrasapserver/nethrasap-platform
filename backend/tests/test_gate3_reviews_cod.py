"""Gate 3 — review integrity (H-20) + COD money-handling (H-5).

H-20: a review now requires a verified purchase. A logged-in user with no
non-cancelled order for the product is rejected 403; a buyer gets 201 with
`is_verified_purchase = True`.

H-5: a COD order never captures on its own, so `captured_at` stays NULL and the
refund path (which needs a captured payment) 409s forever. The new
"mark COD collected" admin action captures the COD payment — recording the cash
AND unlocking refunds — and is idempotent.
"""
from __future__ import annotations

import uuid

import pytest

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


async def _place_cod(client, token: str, variant_id: str, qty: int = 1) -> dict:
    await client.post(
        "/api/v1/cart/items",
        headers=auth(token),
        json={"variant_id": str(variant_id), "quantity": qty},
    )
    r = await client.post(
        "/api/v1/checkout/place",
        headers=auth(token),
        json={
            "address": ADDRESS,
            "payment_method": "cod",
            "client_request_id": str(uuid.uuid4()),
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


async def _drive_to_delivered(client, admin: str, order_number: str) -> None:
    """confirmed (COD) → dispatched → delivered via the staff shipment API."""
    r = await client.post(
        f"/api/v1/admin/orders/{order_number}/shipment",
        headers=auth(admin),
        json={"courier": "BlueDart", "awb_number": "AWB123456"},
    )
    assert r.status_code == 200, r.text
    r = await client.patch(
        f"/api/v1/admin/orders/{order_number}/shipment",
        headers=auth(admin),
        json={"status": "delivered"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "delivered"


# --- H-20: review requires a verified purchase --------------------------------


@pytest.mark.asyncio
async def test_review_without_purchase_is_403(client, seeded_catalogue):
    """A user who never ordered the product cannot review it."""
    token = await signup_token(client, phone_for("gate3-noorder"))
    r = await client.post(
        "/api/v1/products/amoxicillin-500mg-capsules/reviews",
        json={"rating": 1, "title": "hit piece", "body": "never bought this"},
        headers=auth(token),
    )
    assert r.status_code == 403, r.text
    assert "purchase required" in r.text.lower()


@pytest.mark.asyncio
async def test_review_after_purchase_is_verified(client, seeded_catalogue):
    """A buyer can review, and the review is flagged as a verified purchase."""
    token = await signup_token(client, phone_for("gate3-buyer"))
    await _place_cod(client, token, seeded_catalogue["variant"].id)

    r = await client.post(
        "/api/v1/products/amoxicillin-500mg-capsules/reviews",
        json={"rating": 5, "title": "Genuine", "body": "Arrived fast."},
        headers=auth(token),
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["rating"] == 5
    assert body["is_verified_purchase"] is True


# --- H-5: mark COD collected → captured, idempotent, refundable ---------------


@pytest.mark.asyncio
async def test_cod_collect_captures_and_is_idempotent(
    client, seeded_catalogue, staff_tokens
):
    admin = staff_tokens["admin"]
    token = await signup_token(client, phone_for("gate3-cod"))
    order = await _place_cod(client, token, seeded_catalogue["variant"].id)
    on = order["order_number"]
    assert order["payment_status"] == "cod_pending"

    await _drive_to_delivered(client, admin, on)

    # Mark collected → payment captured.
    r = await client.post(
        f"/api/v1/admin/orders/{on}/cod-collected",
        headers=auth(admin),
        json={"note": "cash received at door"},
    )
    assert r.status_code == 200, r.text
    detail = r.json()
    assert detail["payment_status"] == "captured"
    cod = next(p for p in detail["payments"] if p["method"] == "cod")
    assert cod["status"] == "captured"
    assert cod["captured_at"] is not None
    first_captured_at = cod["captured_at"]

    # Second call is a no-op (idempotent) — still captured, same capture time.
    r2 = await client.post(
        f"/api/v1/admin/orders/{on}/cod-collected",
        headers=auth(admin),
        json={},
    )
    assert r2.status_code == 200, r2.text
    cod2 = next(p for p in r2.json()["payments"] if p["method"] == "cod")
    assert cod2["status"] == "captured"
    assert cod2["captured_at"] == first_captured_at


@pytest.mark.asyncio
async def test_cod_refund_blocked_until_collected(
    client, seeded_catalogue, staff_tokens
):
    """Before collection a COD refund 409s; after collection it succeeds."""
    admin = staff_tokens["admin"]
    token = await signup_token(client, phone_for("gate3-cod-refund"))
    order = await _place_cod(client, token, seeded_catalogue["variant"].id)
    on = order["order_number"]

    await _drive_to_delivered(client, admin, on)

    # Refund is impossible while the COD cash is not recorded as captured.
    r = await client.post(
        f"/api/v1/admin/orders/{on}/refund",
        headers=auth(admin),
        json={"reason": "return"},
    )
    assert r.status_code == 409, r.text
    assert "no captured payment" in r.text.lower()

    # Record the cash, unlocking the refund path.
    r = await client.post(
        f"/api/v1/admin/orders/{on}/cod-collected",
        headers=auth(admin),
        json={},
    )
    assert r.status_code == 200, r.text

    # Now a full refund succeeds (was 409 before collection).
    r = await client.post(
        f"/api/v1/admin/orders/{on}/refund",
        headers=auth(admin),
        json={"reason": "return"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["payment_status"] == "refunded"
    assert body["status"] == "refunded"


@pytest.mark.asyncio
async def test_cod_collect_rejected_before_dispatch(
    client, seeded_catalogue, staff_tokens
):
    """A freshly placed COD order (confirmed, not dispatched) can't be collected."""
    admin = staff_tokens["admin"]
    token = await signup_token(client, phone_for("gate3-cod-early"))
    order = await _place_cod(client, token, seeded_catalogue["variant"].id)
    on = order["order_number"]

    r = await client.post(
        f"/api/v1/admin/orders/{on}/cod-collected",
        headers=auth(admin),
        json={},
    )
    assert r.status_code == 409, r.text
