"""Checkout integration tests — quote + place (COD + stubbed gateway)."""
from __future__ import annotations

import uuid

import pytest

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


async def _signup_token(client, email: str) -> str:
    r = await client.post(
        "/api/v1/auth/signup",
        json={
            "role": "customer",
            "email": email,
            "password": "Strongp@ss123",
            "name": email.split("@")[0].title(),
        },
    )
    assert r.status_code == 201
    return r.json()["access_token"]


async def _add_to_cart(client, *, token: str, variant_id: str, quantity: int):
    r = await client.post(
        "/api/v1/cart/items",
        headers={"Authorization": f"Bearer {token}"},
        json={"variant_id": variant_id, "quantity": quantity},
    )
    assert r.status_code == 201, r.text


@pytest.mark.asyncio
async def test_quote_requires_items(client, seeded_catalogue):
    token = await _signup_token(client, "qb1@example.com")
    r = await client.post(
        "/api/v1/checkout/quote",
        headers={"Authorization": f"Bearer {token}"},
        json={"address": ADDRESS, "payment_method": "cod"},
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_quote_math(client, seeded_catalogue):
    token = await _signup_token(client, "qb2@example.com")
    variant_id = str(seeded_catalogue["variant"].id)
    await _add_to_cart(client, token=token, variant_id=variant_id, quantity=3)

    r = await client.post(
        "/api/v1/checkout/quote",
        headers={"Authorization": f"Bearer {token}"},
        json={"address": ADDRESS, "payment_method": "cod"},
    )
    assert r.status_code == 200, r.text
    totals = r.json()["totals"]
    assert totals["subtotal"] == 300                # 3 x 100
    assert totals["gst"] == round(300 * 12 / 100)   # 36 paise
    assert totals["shipping"] == 5000               # below threshold
    assert totals["grand_total"] == 300 + 36 + 5000


@pytest.mark.asyncio
async def test_place_cod_order(client, seeded_catalogue):
    token = await _signup_token(client, "cod@example.com")
    variant_id = str(seeded_catalogue["variant"].id)
    await _add_to_cart(client, token=token, variant_id=variant_id, quantity=2)

    place = await client.post(
        "/api/v1/checkout/place",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "address": ADDRESS,
            "payment_method": "cod",
            "client_request_id": str(uuid.uuid4()),
        },
    )
    assert place.status_code == 201, place.text
    body = place.json()
    assert body["order_number"].startswith("NS-")
    assert body["status"] == "confirmed"
    assert body["payment_status"] == "cod_pending"
    assert body["gateway"] is None


@pytest.mark.asyncio
async def test_place_upi_returns_gateway_handshake(client, seeded_catalogue):
    token = await _signup_token(client, "upi@example.com")
    variant_id = str(seeded_catalogue["variant"].id)
    await _add_to_cart(client, token=token, variant_id=variant_id, quantity=1)

    r = await client.post(
        "/api/v1/checkout/place",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "address": ADDRESS,
            "payment_method": "upi",
            "client_request_id": str(uuid.uuid4()),
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "placed"
    assert body["payment_status"] == "pending"
    assert body["gateway"]["gateway"].startswith("razorpay")
    assert body["gateway"]["gateway_order_id"].startswith("order_stub_")


@pytest.mark.asyncio
async def test_place_is_idempotent_on_client_request_id(client, seeded_catalogue):
    token = await _signup_token(client, "idem@example.com")
    variant_id = str(seeded_catalogue["variant"].id)
    await _add_to_cart(client, token=token, variant_id=variant_id, quantity=1)

    req = str(uuid.uuid4())
    first = await client.post(
        "/api/v1/checkout/place",
        headers={"Authorization": f"Bearer {token}"},
        json={"address": ADDRESS, "payment_method": "cod", "client_request_id": req},
    )
    assert first.status_code == 201
    n1 = first.json()["order_number"]

    second = await client.post(
        "/api/v1/checkout/place",
        headers={"Authorization": f"Bearer {token}"},
        json={"address": ADDRESS, "payment_method": "cod", "client_request_id": req},
    )
    assert second.status_code == 201
    assert second.json()["order_number"] == n1


@pytest.mark.asyncio
async def test_place_clears_cart(client, seeded_catalogue):
    token = await _signup_token(client, "clear@example.com")
    variant_id = str(seeded_catalogue["variant"].id)
    await _add_to_cart(client, token=token, variant_id=variant_id, quantity=1)

    await client.post(
        "/api/v1/checkout/place",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "address": ADDRESS,
            "payment_method": "cod",
            "client_request_id": str(uuid.uuid4()),
        },
    )
    cart = await client.get(
        "/api/v1/cart",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert cart.json()["items"] == []
