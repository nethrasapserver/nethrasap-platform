"""Wishlist + compare tray + payment-method gating."""
from __future__ import annotations

import uuid

import pytest
from app.config import get_settings

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


# --- Wishlist ---------------------------------------------------------------


@pytest.mark.asyncio
async def test_wishlist_requires_auth(client):
    r = await client.get("/api/v1/wishlist")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_wishlist_add_list_remove(client, seeded_catalogue):
    token = await signup_token(client, phone_for("wish1"))
    product_id = str(seeded_catalogue["product"].id)

    r = await client.get("/api/v1/wishlist", headers=auth(token))
    assert r.status_code == 200
    assert r.json()["count"] == 0

    r = await client.put(f"/api/v1/wishlist/items/{product_id}", headers=auth(token))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["count"] == 1
    assert body["product_ids"] == [product_id]
    assert body["items"][0]["product"]["slug"] == "amoxicillin-500mg-capsules"
    # Customer tier pricing (100 paise) — not the retailer tier.
    assert body["items"][0]["product"]["price_min"] == 100

    # Idempotent add.
    r = await client.put(f"/api/v1/wishlist/items/{product_id}", headers=auth(token))
    assert r.status_code == 200
    assert r.json()["count"] == 1

    r = await client.delete(f"/api/v1/wishlist/items/{product_id}", headers=auth(token))
    assert r.status_code == 200
    assert r.json()["count"] == 0

    # Idempotent remove.
    r = await client.delete(f"/api/v1/wishlist/items/{product_id}", headers=auth(token))
    assert r.status_code == 200
    assert r.json()["count"] == 0


@pytest.mark.asyncio
async def test_wishlist_unknown_product_404(client, seeded_catalogue):
    token = await signup_token(client, phone_for("wish2"))
    r = await client.put(f"/api/v1/wishlist/items/{uuid.uuid4()}", headers=auth(token))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_wishlist_is_per_user(client, seeded_catalogue):
    token_a = await signup_token(client, phone_for("wish3a"))
    token_b = await signup_token(client, phone_for("wish3b"))
    product_id = str(seeded_catalogue["product"].id)

    r = await client.put(f"/api/v1/wishlist/items/{product_id}", headers=auth(token_a))
    assert r.status_code == 200

    r = await client.get("/api/v1/wishlist", headers=auth(token_b))
    assert r.json()["count"] == 0


# --- Compare tray -----------------------------------------------------------


@pytest.mark.asyncio
async def test_compare_add_remove_clear(client, multi_catalogue):
    token = await signup_token(client, phone_for("cmp1"))
    products = multi_catalogue["products"]

    r = await client.put(f"/api/v1/compare/items/{products[0].id}", headers=auth(token))
    assert r.status_code == 200, r.text
    assert r.json()["count"] == 1
    assert r.json()["max_items"] == 4

    r = await client.delete(f"/api/v1/compare/items/{products[0].id}", headers=auth(token))
    assert r.json()["count"] == 0

    for p in products[:3]:
        r = await client.put(f"/api/v1/compare/items/{p.id}", headers=auth(token))
        assert r.status_code == 200
    r = await client.delete("/api/v1/compare", headers=auth(token))
    assert r.json()["count"] == 0


@pytest.mark.asyncio
async def test_compare_caps_at_four(client, multi_catalogue):
    token = await signup_token(client, phone_for("cmp2"))
    products = multi_catalogue["products"]
    assert len(products) >= 5

    for p in products[:4]:
        r = await client.put(f"/api/v1/compare/items/{p.id}", headers=auth(token))
        assert r.status_code == 200, r.text
    assert r.json()["count"] == 4

    # Fifth product is rejected …
    r = await client.put(f"/api/v1/compare/items/{products[4].id}", headers=auth(token))
    assert r.status_code == 409

    # … but re-adding one already in the tray stays idempotent, not an error.
    r = await client.put(f"/api/v1/compare/items/{products[0].id}", headers=auth(token))
    assert r.status_code == 200
    assert r.json()["count"] == 4


# --- Payment-method gating ---------------------------------------------------


@pytest.fixture
def cod_only(monkeypatch):
    """Production launch config: COD is the only method offered."""
    monkeypatch.setattr(get_settings(), "payment_methods_enabled", "cod")


@pytest.mark.asyncio
async def test_payment_methods_endpoint_cod_only(client, cod_only):
    r = await client.get("/api/v1/checkout/payment-methods")
    assert r.status_code == 200
    body = r.json()
    assert [m["id"] for m in body["methods"]] == ["cod"]
    assert body["methods"][0]["kind"] == "offline"
    assert body["default"] == "cod"


@pytest.mark.asyncio
async def test_payment_methods_endpoint_full_set(client):
    # Test env enables everything (conftest) — registry order is preserved.
    r = await client.get("/api/v1/checkout/payment-methods")
    assert [m["id"] for m in r.json()["methods"]] == ["cod", "upi", "card", "netbanking", "wallet"]


@pytest.mark.asyncio
async def test_quote_rejects_disabled_method(client, seeded_catalogue, cod_only):
    token = await signup_token(client, phone_for("pay1"))
    r = await client.post(
        "/api/v1/cart/items",
        headers=auth(token),
        json={"variant_id": str(seeded_catalogue["variant"].id), "quantity": 1},
    )
    assert r.status_code == 201

    r = await client.post(
        "/api/v1/checkout/quote",
        headers=auth(token),
        json={"address": ADDRESS, "payment_method": "upi"},
    )
    assert r.status_code == 400
    assert "not available" in r.json()["detail"]


@pytest.mark.asyncio
async def test_place_rejects_disabled_method_but_allows_cod(client, seeded_catalogue, cod_only):
    token = await signup_token(client, phone_for("pay2"))
    r = await client.post(
        "/api/v1/cart/items",
        headers=auth(token),
        json={"variant_id": str(seeded_catalogue["variant"].id), "quantity": 1},
    )
    assert r.status_code == 201

    r = await client.post(
        "/api/v1/checkout/place",
        headers=auth(token),
        json={
            "address": ADDRESS,
            "payment_method": "upi",
            "client_request_id": str(uuid.uuid4()),
        },
    )
    assert r.status_code == 400

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
    body = r.json()
    assert body["payment_status"] == "cod_pending"
    assert body["gateway"] is None


@pytest.mark.asyncio
async def test_unknown_method_is_schema_rejected(client, seeded_catalogue):
    token = await signup_token(client, phone_for("pay3"))
    r = await client.post(
        "/api/v1/checkout/quote",
        headers=auth(token),
        json={"address": ADDRESS, "payment_method": "cheque"},
    )
    assert r.status_code == 422
