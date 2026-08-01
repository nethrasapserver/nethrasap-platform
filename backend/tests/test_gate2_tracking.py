"""Gate 2 — H-1 regression: the public order-tracking endpoint must not leak
any order's data to an unauthenticated caller who omits `phone_last4`.

Order numbers are sequential (NS-YYYY-NNNNN), so a fall-through that returns the
order without a phone check turns the whole order book into a scrapeable list.
These tests pin the fail-closed behaviour:

  (a) unauthenticated, NO phone_last4      -> 401/403, never 200 + data
  (b) unauthenticated, WRONG phone_last4   -> 403
  (c) unauthenticated, CORRECT phone_last4 -> 200
  (d) authenticated owner, NO phone_last4  -> 200
  (e) a different authenticated customer   -> 403/404, never the order
"""
from __future__ import annotations

import uuid

import pytest

from .conftest import phone_for, signup_token

# Mirrors tests/test_orders.py — the shipping phone's last 4 digits are "3210".
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
CORRECT_LAST4 = "3210"
WRONG_LAST4 = "0000"


async def _signup_token(client, ident: str) -> str:
    return await signup_token(client, phone_for(ident))


async def _place_cod(client, token: str, variant_id: str, quantity: int = 1) -> str:
    await client.post(
        "/api/v1/cart/items",
        headers={"Authorization": f"Bearer {token}"},
        json={"variant_id": variant_id, "quantity": quantity},
    )
    r = await client.post(
        "/api/v1/checkout/place",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "address": ADDRESS,
            "payment_method": "cod",
            "client_request_id": str(uuid.uuid4()),
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["order_number"]


@pytest.mark.asyncio
async def test_track_unauthenticated_without_phone_is_rejected(client, seeded_catalogue):
    """H-1: no auth + no phone_last4 must NOT return the order."""
    token = await _signup_token(client, "gate2_leak@example.com")
    variant_id = str(seeded_catalogue["variant"].id)
    number = await _place_cod(client, token, variant_id)

    r = await client.get(f"/api/v1/orders/{number}/track")
    assert r.status_code in (401, 403), r.text
    # Fail closed: none of the sensitive fields may leak in the error body.
    body = r.json()
    assert "grand_total" not in body
    assert "status" not in body
    assert body.get("order_number") is None


@pytest.mark.asyncio
async def test_track_unauthenticated_wrong_phone_is_403(client, seeded_catalogue):
    token = await _signup_token(client, "gate2_wrong@example.com")
    variant_id = str(seeded_catalogue["variant"].id)
    number = await _place_cod(client, token, variant_id)

    r = await client.get(f"/api/v1/orders/{number}/track?phone_last4={WRONG_LAST4}")
    assert r.status_code == 403, r.text


@pytest.mark.asyncio
async def test_track_unauthenticated_correct_phone_is_200(client, seeded_catalogue):
    token = await _signup_token(client, "gate2_right@example.com")
    variant_id = str(seeded_catalogue["variant"].id)
    number = await _place_cod(client, token, variant_id)

    r = await client.get(f"/api/v1/orders/{number}/track?phone_last4={CORRECT_LAST4}")
    assert r.status_code == 200, r.text
    assert r.json()["order_number"] == number


@pytest.mark.asyncio
async def test_track_authed_owner_without_phone_is_200(client, seeded_catalogue):
    token = await _signup_token(client, "gate2_owner@example.com")
    variant_id = str(seeded_catalogue["variant"].id)
    number = await _place_cod(client, token, variant_id)

    r = await client.get(
        f"/api/v1/orders/{number}/track",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["order_number"] == number


@pytest.mark.asyncio
async def test_track_different_authed_customer_cannot_see_order(client, seeded_catalogue):
    """A signed-in customer who is not the owner must not get the order without
    proving the phone — expect 403/404, never the order body."""
    owner = await _signup_token(client, "gate2_owner2@example.com")
    other = await _signup_token(client, "gate2_other@example.com")
    variant_id = str(seeded_catalogue["variant"].id)
    number = await _place_cod(client, owner, variant_id)

    r = await client.get(
        f"/api/v1/orders/{number}/track",
        headers={"Authorization": f"Bearer {other}"},
    )
    assert r.status_code in (403, 404), r.text
    assert r.json().get("order_number") is None
