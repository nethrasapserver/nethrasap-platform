"""Quote (RFQ) flow — ranged pricing, cart handling, checkout guard, conversion."""
from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select, update

from app.models.catalogue import ProductPrice, ProductVariant

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


async def _set_range(db_session, product, rmin: int, rmax: int) -> None:
    """Give a product's live price rows an indicative band (→ quote-only)."""
    variant_ids = select(ProductVariant.id).where(ProductVariant.product_id == product.id)
    await db_session.execute(
        update(ProductPrice)
        .where(ProductPrice.variant_id.in_(variant_ids), ProductPrice.valid_to.is_(None))
        .values(range_min=rmin, range_max=rmax)
    )
    await db_session.flush()


async def _variant_id(db_session, product) -> str:
    vid = (
        await db_session.execute(
            select(ProductVariant.id).where(ProductVariant.product_id == product.id)
        )
    ).scalar_one()
    return str(vid)


@pytest.mark.asyncio
async def test_ranged_price_makes_product_quote_only(client, db_session, multi_catalogue):
    quoted = multi_catalogue["products"][0]
    await _set_range(db_session, quoted, 1500, 2500)

    r = await client.get(f"/api/v1/products/{quoted.slug}")
    body = r.json()
    assert body["is_quote_only"] is True
    assert (body["price_min"], body["price_max"]) == (1500, 2500)

    # A product without a band stays a normal fixed-price sale.
    fixed = multi_catalogue["products"][1]
    r = await client.get(f"/api/v1/products/{fixed.slug}")
    assert r.json()["is_quote_only"] is False


@pytest.mark.asyncio
async def test_cart_flags_quote_items_and_excludes_them_from_totals(
    client, db_session, multi_catalogue
):
    quoted, fixed = multi_catalogue["products"][0], multi_catalogue["products"][1]
    await _set_range(db_session, quoted, 1500, 2500)
    token = await signup_token(client, phone_for("qf-cart"))

    for product in (quoted, fixed):
        vid = await _variant_id(db_session, product)
        r = await client.post(
            "/api/v1/cart/items", headers=auth(token), json={"variant_id": vid, "quantity": 2}
        )
        assert r.status_code == 201, r.text

    cart = (await client.get("/api/v1/cart", headers=auth(token))).json()
    flags = {it["product"]["slug"]: it["is_quote_only"] for it in cart["items"]}
    assert flags[quoted.slug] is True
    assert flags[fixed.slug] is False

    # Totals cover ONLY the payable (fixed) line: 2 × 30p tax-inclusive = 60p.
    # The quoted line (2 × 100p anchor) must not appear anywhere in the money.
    assert cart["totals"]["subtotal"] + cart["totals"]["gst"] == 60


@pytest.mark.asyncio
async def test_checkout_rejects_quote_only_cart(client, db_session, multi_catalogue):
    quoted = multi_catalogue["products"][0]
    await _set_range(db_session, quoted, 1500, 2500)
    token = await signup_token(client, phone_for("qf-guard"))
    vid = await _variant_id(db_session, quoted)
    await client.post("/api/v1/cart/items", headers=auth(token), json={"variant_id": vid, "quantity": 1})

    r = await client.post(
        "/api/v1/checkout/quote",
        headers=auth(token),
        json={"address": ADDRESS, "payment_method": "cod"},
    )
    assert r.status_code == 400
    assert "quote" in r.json()["detail"]


@pytest.mark.asyncio
async def test_mixed_cart_sells_fixed_and_keeps_quote_items(client, db_session, multi_catalogue):
    quoted, fixed = multi_catalogue["products"][0], multi_catalogue["products"][1]
    await _set_range(db_session, quoted, 1500, 2500)
    token = await signup_token(client, phone_for("qf-mixed"))

    qvid = await _variant_id(db_session, quoted)
    fvid = await _variant_id(db_session, fixed)
    await client.post("/api/v1/cart/items", headers=auth(token), json={"variant_id": qvid, "quantity": 3})
    await client.post("/api/v1/cart/items", headers=auth(token), json={"variant_id": fvid, "quantity": 1})

    r = await client.post(
        "/api/v1/checkout/place",
        headers=auth(token),
        json={"address": ADDRESS, "payment_method": "cod", "client_request_id": str(uuid.uuid4())},
    )
    assert r.status_code == 201, r.text
    order_number = r.json()["order_number"]

    # The order contains only the fixed line…
    order = (await client.get(f"/api/v1/orders/{order_number}", headers=auth(token))).json()
    assert [it["quantity"] for it in order["items"]] == [1]

    # …and the quote line survived in the cart for the RFQ path.
    cart = (await client.get("/api/v1/cart", headers=auth(token))).json()
    assert len(cart["items"]) == 1
    assert cart["items"][0]["is_quote_only"] is True
    assert cart["items"][0]["quantity"] == 3


@pytest.mark.asyncio
async def test_full_quote_lifecycle_to_order(client, db_session, multi_catalogue, staff_tokens):
    """create → staff quotes → customer accepts → staff converts → COD order."""
    quoted = multi_catalogue["products"][0]
    await _set_range(db_session, quoted, 1500, 2500)
    token = await signup_token(client, phone_for("qf-life"))
    vid = await _variant_id(db_session, quoted)

    r = await client.post(
        "/api/v1/enquiries",
        headers=auth(token),
        json={"items": [{"variant_id": vid, "quantity": 10}], "note": "monthly stock"},
    )
    assert r.status_code == 201, r.text
    enq = r.json()
    assert enq["status"] == "pending"

    item_id = enq["items"][0]["id"]
    # A manager quoting releases straight away (no separate approval step needed).
    r = await client.post(
        f"/api/v1/admin/enquiries/{enq['id']}/quote",
        headers=auth(staff_tokens["manager"]),
        json={"lines": [{"item_id": item_id, "unit_price": 1800}], "valid_days": 7},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "quoted"
    assert r.json()["approval_status"] == "approved"
    assert r.json()["quoted_total"] == 18000  # 10 × ₹18 within the ₹15–25 band

    r = await client.post(f"/api/v1/enquiries/{enq['id']}/accept", headers=auth(token))
    assert r.json()["status"] == "confirmed"

    r = await client.post(
        f"/api/v1/admin/enquiries/{enq['id']}/convert", headers=auth(staff_tokens["sales"])
    )
    assert r.status_code == 200, r.text
    order_number = r.json()["order_number"]
    assert r.json()["enquiry"]["converted_order_number"] == order_number

    # The customer can read the converted order; it is COD at the quoted price.
    order = (await client.get(f"/api/v1/orders/{order_number}", headers=auth(token))).json()
    assert order["payment_status"] == "cod_pending"
    assert order["grand_total"] == 18000
