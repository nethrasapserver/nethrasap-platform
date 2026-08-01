"""Gate 1 checkout remediation tests.

Covers the three confirmed-live defects fixed in services/checkout.py +
services/pricing.py:

  * H-7  — coupon `max_uses` must be enforced atomically (conditional UPDATE),
           not via a Python read-modify-write.
  * H-15 — the idempotency replay must be scoped to the current user so one
           user's `client_request_id` can never return another user's order.
  * H-9  — order-level GST is charged on the taxable value AFTER the discount
           (s.15(3) CGST), not on the pre-discount base. Line-level extraction
           is left untouched.

These are sequential/integration proofs. The concurrency guarantee for H-7 (N
parallel checkouts of a max_uses=1 coupon => exactly one redemption) is what the
atomic conditional UPDATE provides; the lead race-tests it with parallel curls.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import select, update

from app.models.cart import Coupon, CouponType
from app.models.order import Order

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


async def _token(client, ident: str) -> str:
    return await signup_token(client, phone_for(ident))


async def _add_to_cart(client, *, token: str, variant_id: str, quantity: int) -> None:
    r = await client.post(
        "/api/v1/cart/items",
        headers=auth(token),
        json={"variant_id": variant_id, "quantity": quantity},
    )
    assert r.status_code == 201, r.text


async def _apply_coupon(client, *, token: str, code: str):
    return await client.post(
        "/api/v1/cart/coupon", headers=auth(token), json={"code": code}
    )


async def _place(client, *, token: str, req_id: str, payment_method: str = "cod"):
    return await client.post(
        "/api/v1/checkout/place",
        headers=auth(token),
        json={
            "address": ADDRESS,
            "payment_method": payment_method,
            "client_request_id": req_id,
        },
    )


async def _quote(client, *, token: str):
    return await client.post(
        "/api/v1/checkout/quote",
        headers=auth(token),
        json={"address": ADDRESS, "payment_method": "cod"},
    )


async def _seed_priced_variant(db, *, slug: str, price_paise: int, gst_rate_pct: int = 12):
    """Insert a category+product+variant+customer price at an exact paise price.

    Kept local (not a shared fixture) so the GST arithmetic below is pinned to a
    price this test controls rather than conftest's ₹1 seed.
    """
    from app.models.catalogue import (
        Category,
        PriceRole,
        Product,
        ProductPrice,
        ProductVariant,
        ScheduleClass,
        StockStatus,
    )

    cat = Category(slug=f"cat-{slug}", name=f"Cat {slug}", sku_prefix="RX", sort_order=0)
    db.add(cat)
    await db.flush()
    product = Product(
        slug=slug,
        name=slug,
        description="Gate-1 fixture product.",
        category_id=cat.id,
        sub_category="Fixture",
        schedule=ScheduleClass.H,
        stock_status=StockStatus.in_stock,
        gst_rate_pct=gst_rate_pct,
    )
    db.add(product)
    await db.flush()
    variant = ProductVariant(
        product_id=product.id,
        pack_size="1 unit",
        unit_label="1 unit",
        is_default=True,
    )
    db.add(variant)
    await db.flush()
    db.add(
        ProductPrice(
            variant_id=variant.id,
            role=PriceRole.customer,
            mrp=price_paise,
            selling_price=price_paise,
            currency="INR",
            valid_from=datetime.now(UTC),
        )
    )
    await db.flush()
    return variant


# ---------------------------------------------------------------------------
# H-7 — coupon max_uses enforced atomically
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_conditional_update_bounds_redemption_at_max_uses(db_session):
    """Directly exercises the atomic redemption SQL the fix relies on: the same
    conditional UPDATE claims exactly one redemption then updates zero rows once
    the cap is hit. This is the primitive that makes N concurrent checkouts of a
    max_uses=1 coupon resolve to a single winner."""
    coupon = Coupon(
        code="ONCE",
        type=CouponType.percent,
        value=10,
        min_order=0,
        max_uses=1,
        used_count=0,
        is_active=True,
    )
    db_session.add(coupon)
    await db_session.flush()

    stmt = (
        update(Coupon)
        .where(
            Coupon.id == coupon.id,
            (Coupon.max_uses.is_(None)) | (Coupon.used_count < Coupon.max_uses),
        )
        .values(used_count=Coupon.used_count + 1)
        .returning(Coupon.used_count)
    )

    first = (await db_session.execute(stmt)).scalar_one_or_none()
    assert first == 1  # claimed the single allowed redemption

    second = (await db_session.execute(stmt)).scalar_one_or_none()
    assert second is None  # cap reached -> zero rows updated -> caller rejects


@pytest.mark.asyncio
async def test_coupon_used_count_correct_and_cap_enforced_end_to_end(
    client, db_session, seeded_catalogue
):
    """A real discounted checkout increments used_count exactly once, and once a
    max_uses=1 coupon is spent it can no longer be applied."""
    coupon = Coupon(
        code="SAVE10",
        type=CouponType.percent,
        value=10,
        min_order=0,
        max_uses=1,
        used_count=0,
        is_active=True,
    )
    db_session.add(coupon)
    await db_session.flush()

    variant_id = str(seeded_catalogue["variant"].id)

    # User 1 redeems the coupon.
    t1 = await _token(client, "gate1-h7-u1")
    await _add_to_cart(client, token=t1, variant_id=variant_id, quantity=1)
    applied = await _apply_coupon(client, token=t1, code="SAVE10")
    assert applied.status_code == 200, applied.text
    placed = await _place(client, token=t1, req_id=str(uuid.uuid4()))
    assert placed.status_code == 201, placed.text

    await db_session.refresh(coupon)
    assert coupon.used_count == 1  # incremented exactly once, not clobbered

    # User 2 can no longer apply the spent coupon (cap enforced end-to-end).
    t2 = await _token(client, "gate1-h7-u2")
    await _add_to_cart(client, token=t2, variant_id=variant_id, quantity=1)
    rejected = await _apply_coupon(client, token=t2, code="SAVE10")
    assert rejected.status_code == 400, rejected.text
    assert "usage limit reached" in rejected.text.lower()

    await db_session.refresh(coupon)
    assert coupon.used_count == 1  # still 1 — the rejected attempt did not bump


# ---------------------------------------------------------------------------
# H-15 — idempotency key is scoped to the current user
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_replaying_another_users_request_id_does_not_leak_their_order(
    client, seeded_catalogue
):
    variant_id = str(seeded_catalogue["variant"].id)
    shared_key = str(uuid.uuid4())

    # User A places a genuine order under `shared_key`.
    ta = await _token(client, "gate1-h15-a")
    await _add_to_cart(client, token=ta, variant_id=variant_id, quantity=1)
    a_order = await _place(client, token=ta, req_id=shared_key)
    assert a_order.status_code == 201, a_order.text
    a_number = a_order.json()["order_number"]

    # User B replays A's client_request_id. B must NOT receive A's order.
    tb = await _token(client, "gate1-h15-b")
    await _add_to_cart(client, token=tb, variant_id=variant_id, quantity=1)
    b_replay = await _place(client, token=tb, req_id=shared_key)
    assert b_replay.status_code != 201 or b_replay.json()["order_number"] != a_number
    if b_replay.status_code == 201:
        pytest.fail("cross-user idempotency leak: B received an order on A's key")

    # And B can still place their own order under a fresh key.
    b_own = await _place(client, token=tb, req_id=str(uuid.uuid4()))
    assert b_own.status_code == 201, b_own.text
    assert b_own.json()["order_number"] != a_number


@pytest.mark.asyncio
async def test_same_user_replay_still_idempotent(client, seeded_catalogue):
    """Regression guard: the H-15 user filter must not break same-user replay."""
    variant_id = str(seeded_catalogue["variant"].id)
    t = await _token(client, "gate1-h15-same")
    await _add_to_cart(client, token=t, variant_id=variant_id, quantity=1)

    key = str(uuid.uuid4())
    first = await _place(client, token=t, req_id=key)
    assert first.status_code == 201, first.text
    second = await _place(client, token=t, req_id=key)
    assert second.status_code == 201, second.text
    assert second.json()["order_number"] == first.json()["order_number"]


# ---------------------------------------------------------------------------
# H-9 — GST charged on the post-discount taxable base
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_discounted_order_gst_is_on_post_discount_base(client, db_session):
    """Mirrors the audit's NS-2026-00033 case in exact paise.

    Line is tax-INCLUSIVE ₹600.00 (60000 paise) at 12% GST:
        taxable (ex-GST)      = 60000 - gst_within(60000,12)=6429  => 53571
        discount 10% of taxable                                    =  5357
        taxable after discount                                     = 48214
        GST (post-discount)  = round_half_up(48214 * 12/100)       =  5786   <-- fix
        (pre-fix bug charged gst on 53571 => 6429)
        inclusive goods paid = 48214 + 5786                        = 54000
        shipping: 54000 >= 50000 threshold                         =     0
        grand_total                                                = 54000
    """
    variant = await _seed_priced_variant(db_session, slug="gate1-gst", price_paise=60000)
    variant_id = str(variant.id)

    coupon = Coupon(
        code="TEN",
        type=CouponType.percent,
        value=10,
        min_order=0,
        max_uses=None,
        used_count=0,
        is_active=True,
    )
    db_session.add(coupon)
    await db_session.flush()

    t = await _token(client, "gate1-h9")
    await _add_to_cart(client, token=t, variant_id=variant_id, quantity=1)
    applied = await _apply_coupon(client, token=t, code="TEN")
    assert applied.status_code == 200, applied.text

    q = await _quote(client, token=t)
    assert q.status_code == 200, q.text
    totals = q.json()["totals"]
    assert totals["subtotal"] == 53571
    assert totals["discount"] == 5357
    assert totals["gst"] == 5786         # GST on (taxable - discount), not 6429
    assert totals["shipping"] == 0       # free: inclusive paid (54000) >= 50000
    assert totals["grand_total"] == 54000

    # The stored order value (what the invoice renderer reads) is corrected too.
    placed = await _place(client, token=t, req_id=str(uuid.uuid4()))
    assert placed.status_code == 201, placed.text
    order_number = placed.json()["order_number"]

    db_session.expire_all()
    order = (
        await db_session.execute(
            select(Order).where(Order.order_number == order_number)
        )
    ).scalar_one()
    assert order.gst_total == 5786
    assert order.discount_total == 5357
    assert order.grand_total == 54000


@pytest.mark.asyncio
async def test_full_discount_zeroes_gst(client, db_session):
    """A 100%-discount order carries zero output GST (taxable base -> 0)."""
    variant = await _seed_priced_variant(db_session, slug="gate1-full", price_paise=60000)
    coupon = Coupon(
        code="ALL100",
        type=CouponType.percent,
        value=100,
        min_order=0,
        max_uses=None,
        used_count=0,
        is_active=True,
    )
    db_session.add(coupon)
    await db_session.flush()

    t = await _token(client, "gate1-h9-full")
    await _add_to_cart(client, token=t, variant_id=str(variant.id), quantity=1)
    applied = await _apply_coupon(client, token=t, code="ALL100")
    assert applied.status_code == 200, applied.text

    q = await _quote(client, token=t)
    assert q.status_code == 200, q.text
    totals = q.json()["totals"]
    assert totals["discount"] == totals["subtotal"]
    assert totals["gst"] == 0  # no taxable value left, so no GST
