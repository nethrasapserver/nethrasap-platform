"""Unit tests for the central money math in services/pricing.py."""
from __future__ import annotations

from datetime import UTC

from app.services.pricing import (
    compute_line,
    coupon_discount,
    shipping_for,
)


class _StubCoupon:
    """Lightweight stand-in for the Coupon model — only needs the
    attributes pricing.* reads from."""

    def __init__(self, type, value, is_active=True, min_order=0,
                 max_uses=None, used_count=0, expires_at=None):
        from types import SimpleNamespace
        # mimic Enum.value access
        self.type = SimpleNamespace(value=type)
        # but pricing.coupon_discount compares `coupon.type == CouponType.percent`
        # — keep the real enum below for tests that need it
        self.value = value
        self.is_active = is_active
        self.min_order = min_order
        self.max_uses = max_uses
        self.used_count = used_count
        self.expires_at = expires_at


def test_compute_line_basic():
    line = compute_line(quantity=2, unit_price=10000, gst_rate_pct=12)
    assert line.subtotal == 20000
    assert line.gst_amount == 2400
    assert line.line_total == 22400


def test_compute_line_rounds_gst_half_up():
    # subtotal * 5 / 100 with subtotal=99 → 4.95, rounded to 5
    line = compute_line(quantity=1, unit_price=99, gst_rate_pct=5)
    assert line.gst_amount == 5


def test_shipping_free_above_threshold():
    assert shipping_for(subtotal_after_discount=50_000, has_cold_chain=False) == 0
    assert shipping_for(subtotal_after_discount=49_999, has_cold_chain=False) == 5000


def test_shipping_cold_chain_overrides():
    assert shipping_for(subtotal_after_discount=100_000, has_cold_chain=True) == 12000


def test_coupon_discount_no_coupon():
    assert coupon_discount(None, 10000) == 0


def test_coupon_discount_flat_capped():
    from app.models.cart import Coupon, CouponType

    coupon = Coupon(
        code="X",
        type=CouponType.flat,
        value=50_000,           # ₹500 off
        min_order=0,
        used_count=0,
        is_active=True,
    )
    # Discount caps at subtotal
    assert coupon_discount(coupon, 10_000) == 10_000
    assert coupon_discount(coupon, 100_000) == 50_000


def test_coupon_discount_percent():
    from app.models.cart import Coupon, CouponType

    coupon = Coupon(
        code="P10", type=CouponType.percent, value=10,
        min_order=0, used_count=0, is_active=True,
    )
    assert coupon_discount(coupon, 12345) == 1234  # integer math


def test_is_coupon_eligible_min_order():

    from app.models.cart import Coupon, CouponType
    from app.services.pricing import is_coupon_eligible

    coupon = Coupon(
        code="MIN", type=CouponType.percent, value=10,
        min_order=50_000, used_count=0, is_active=True,
    )
    ok, _ = is_coupon_eligible(coupon, 50_000)
    assert ok is True
    not_ok, reason = is_coupon_eligible(coupon, 49_999)
    assert not_ok is False
    assert "minimum order" in (reason or "").lower()


def test_is_coupon_eligible_expired():
    from datetime import datetime, timedelta

    from app.models.cart import Coupon, CouponType
    from app.services.pricing import is_coupon_eligible

    expired = Coupon(
        code="E", type=CouponType.percent, value=10,
        min_order=0, used_count=0, is_active=True,
        expires_at=datetime.now(UTC) - timedelta(days=1),
    )
    ok, reason = is_coupon_eligible(expired, 10_000)
    assert ok is False
    assert reason == "coupon expired"
