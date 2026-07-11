"""Orders endpoint tests — list, get, cancel, reorder, track."""
from __future__ import annotations

import uuid

import pytest

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


async def _signup_token(client, ident: str) -> str:
    """Signup via the phone-first OTP flow; `ident` maps to a stable phone."""
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
async def test_list_orders_only_my_own(client, seeded_catalogue):
    token_a = await _signup_token(client, "ord_a@example.com")
    token_b = await _signup_token(client, "ord_b@example.com")
    variant_id = str(seeded_catalogue["variant"].id)
    await _place_cod(client, token_a, variant_id)
    await _place_cod(client, token_b, variant_id)

    r_a = await client.get("/api/v1/orders", headers={"Authorization": f"Bearer {token_a}"})
    assert r_a.status_code == 200
    assert r_a.json()["total"] == 1


@pytest.mark.asyncio
async def test_get_order_detail(client, seeded_catalogue):
    token = await _signup_token(client, "ord_detail@example.com")
    variant_id = str(seeded_catalogue["variant"].id)
    number = await _place_cod(client, token, variant_id, quantity=2)

    r = await client.get(
        f"/api/v1/orders/{number}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["order_number"] == number
    assert body["items"][0]["quantity"] == 2
    assert body["shipping_address"]["city"] == "Mumbai"
    assert len(body["status_history"]) >= 1


@pytest.mark.asyncio
async def test_cancel_within_window(client, seeded_catalogue):
    token = await _signup_token(client, "cancel@example.com")
    variant_id = str(seeded_catalogue["variant"].id)
    number = await _place_cod(client, token, variant_id)

    r = await client.post(
        f"/api/v1/orders/{number}/cancel",
        headers={"Authorization": f"Bearer {token}"},
        json={"reason": "changed mind"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "cancelled"

    # Cannot cancel twice
    second = await client.post(
        f"/api/v1/orders/{number}/cancel",
        headers={"Authorization": f"Bearer {token}"},
        json={"reason": "again"},
    )
    assert second.status_code == 409


@pytest.mark.asyncio
async def test_reorder_copies_items_back_to_cart(client, seeded_catalogue):
    token = await _signup_token(client, "reorder@example.com")
    variant_id = str(seeded_catalogue["variant"].id)
    number = await _place_cod(client, token, variant_id, quantity=3)

    cart_before = await client.get(
        "/api/v1/cart", headers={"Authorization": f"Bearer {token}"}
    )
    assert cart_before.json()["items"] == []

    r = await client.post(
        f"/api/v1/orders/{number}/reorder",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert r.json()["items_added"] == 1

    cart_after = await client.get(
        "/api/v1/cart", headers={"Authorization": f"Bearer {token}"}
    )
    items = cart_after.json()["items"]
    assert len(items) == 1
    assert items[0]["quantity"] == 3


@pytest.mark.asyncio
async def test_track_public_requires_phone_last4(client, seeded_catalogue):
    token = await _signup_token(client, "track@example.com")
    variant_id = str(seeded_catalogue["variant"].id)
    number = await _place_cod(client, token, variant_id)

    # No auth, no phone — current implementation falls through to public path,
    # which compares against the empty `phone_last4`. With no last4 match
    # required, this should still succeed (private check disabled).
    # Wrong last4 should 403.
    r_wrong = await client.get(f"/api/v1/orders/{number}/track?phone_last4=0000")
    assert r_wrong.status_code == 403

    r_right = await client.get(f"/api/v1/orders/{number}/track?phone_last4=3210")
    assert r_right.status_code == 200
    assert r_right.json()["order_number"] == number


@pytest.mark.asyncio
async def test_track_authed_owner(client, seeded_catalogue):
    token = await _signup_token(client, "track_owner@example.com")
    variant_id = str(seeded_catalogue["variant"].id)
    number = await _place_cod(client, token, variant_id)

    r = await client.get(
        f"/api/v1/orders/{number}/track",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert r.json()["order_number"] == number
