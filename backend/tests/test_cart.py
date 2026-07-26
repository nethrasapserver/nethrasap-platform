"""Cart endpoint integration tests."""
from __future__ import annotations

import pytest

from .conftest import phone_for, signup_token


async def _signup_and_token(client, ident: str, role: str = "customer") -> str:
    """Signup via the phone-first OTP flow; `ident` maps to a stable phone."""
    return await signup_token(client, phone_for(ident), role=role)


@pytest.mark.asyncio
async def test_cart_anon_get_creates_session(client, seeded_catalogue):
    resp = await client.get("/api/v1/cart")
    assert resp.status_code == 200
    body = resp.json()
    assert body["items"] == []
    assert body["totals"]["subtotal"] == 0
    assert "nethrasap.session" in resp.headers.get("set-cookie", "")


@pytest.mark.asyncio
async def test_cart_add_and_update_and_remove(client, seeded_catalogue):
    variant_id = str(seeded_catalogue["variant"].id)

    add = await client.post(
        "/api/v1/cart/items",
        json={"variant_id": variant_id, "quantity": 2},
    )
    assert add.status_code == 201
    body = add.json()
    assert len(body["items"]) == 1
    assert body["items"][0]["quantity"] == 2
    assert body["totals"]["subtotal"] == 179  # 2 x 100 paise incl. tax → ₹1.79 taxable

    item_id = body["items"][0]["id"]
    upd = await client.patch(
        f"/api/v1/cart/items/{item_id}",
        json={"quantity": 5},
    )
    assert upd.status_code == 200
    assert upd.json()["items"][0]["quantity"] == 5

    rem = await client.delete(f"/api/v1/cart/items/{item_id}")
    assert rem.status_code == 200
    assert rem.json()["items"] == []


@pytest.mark.asyncio
async def test_cart_apply_coupon_min_order(client, seeded_catalogue, db_session):
    from app.models.cart import Coupon, CouponType

    db_session.add(
        Coupon(
            code="TENOFF",
            type=CouponType.percent,
            value=10,
            min_order=500,  # ₹5 minimum (in paise)
            is_active=True,
        )
    )
    await db_session.flush()

    variant_id = str(seeded_catalogue["variant"].id)
    await client.post(
        "/api/v1/cart/items",
        json={"variant_id": variant_id, "quantity": 6},  # 6 x 100 paise = 600 paise
    )

    apply = await client.post(
        "/api/v1/cart/coupon",
        json={"code": "TENOFF"},
    )
    assert apply.status_code == 200
    body = apply.json()
    assert body["coupon"]["code"] == "TENOFF"
    assert body["totals"]["discount"] == 53  # 10% of the 536p taxable value

    clear = await client.delete("/api/v1/cart/coupon")
    assert clear.status_code == 200
    assert clear.json()["coupon"] is None
    assert clear.json()["totals"]["discount"] == 0


@pytest.mark.asyncio
async def test_cart_apply_coupon_min_order_violation(client, seeded_catalogue, db_session):
    from app.models.cart import Coupon, CouponType

    db_session.add(
        Coupon(
            code="BIGORDER",
            type=CouponType.flat,
            value=10_000,
            min_order=1_000_000,   # ₹10,000
            is_active=True,
        )
    )
    await db_session.flush()

    variant_id = str(seeded_catalogue["variant"].id)
    await client.post(
        "/api/v1/cart/items",
        json={"variant_id": variant_id, "quantity": 1},
    )
    apply = await client.post(
        "/api/v1/cart/coupon",
        json={"code": "BIGORDER"},
    )
    assert apply.status_code == 400
    assert "minimum order" in apply.json()["detail"].lower()


@pytest.mark.asyncio
async def test_cart_merges_on_login(client, seeded_catalogue):
    # 1. Anon adds item
    variant_id = str(seeded_catalogue["variant"].id)
    anon = await client.post(
        "/api/v1/cart/items",
        json={"variant_id": variant_id, "quantity": 3},
    )
    assert anon.status_code == 201

    # 2. Sign up — should fold the anon cart in.
    token = await _signup_and_token(client, "merge@example.com")

    # 3. Authed GET /cart shows the items
    cart = await client.get(
        "/api/v1/cart",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert cart.status_code == 200
    body = cart.json()
    assert body["user_id"] is not None
    assert len(body["items"]) == 1
    assert body["items"][0]["quantity"] == 3
