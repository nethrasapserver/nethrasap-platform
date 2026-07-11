"""Central money math — every total computed in paise (integer)."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from ..models.cart import Coupon, CouponType
from ..models.catalogue import ScheduleClass

# ---------------------------------------------------------------------------
# Shipping rules — Phase 3 keeps it simple. Refine when warehouses come online.
# ---------------------------------------------------------------------------
FREE_SHIPPING_THRESHOLD_PAISE = 50_000  # ₹500
DEFAULT_SHIPPING_PAISE = 5_000          # ₹50
COLD_CHAIN_SHIPPING_PAISE = 12_000      # ₹120

# Default GST rate when the product row lacks one (shouldn't happen post-Phase 3).
DEFAULT_GST_RATE_PCT = 12


@dataclass(slots=True)
class LineMath:
    quantity: int
    unit_price: int      # paise
    gst_rate_pct: int
    subtotal: int        # paise: quantity * unit_price
    gst_amount: int      # paise: integer-rounded GST on the subtotal
    line_total: int      # paise: subtotal + gst_amount


def compute_line(quantity: int, unit_price: int, gst_rate_pct: int | None) -> LineMath:
    if quantity < 1:
        raise ValueError("quantity must be >= 1")
    if unit_price < 0:
        raise ValueError("unit_price must be >= 0")
    rate = gst_rate_pct if gst_rate_pct is not None else DEFAULT_GST_RATE_PCT
    subtotal = quantity * unit_price
    # Integer GST: round to nearest paisa (Indian invoicing convention is
    # ROUND_HALF_UP at line level; Python's // is banker's. Use explicit add.)
    gst_amount = (subtotal * rate + 50) // 100
    line_total = subtotal + gst_amount
    return LineMath(
        quantity=quantity,
        unit_price=unit_price,
        gst_rate_pct=rate,
        subtotal=subtotal,
        gst_amount=gst_amount,
        line_total=line_total,
    )


def shipping_for(*, subtotal_after_discount: int, has_cold_chain: bool) -> int:
    if has_cold_chain:
        return COLD_CHAIN_SHIPPING_PAISE
    if subtotal_after_discount >= FREE_SHIPPING_THRESHOLD_PAISE:
        return 0
    return DEFAULT_SHIPPING_PAISE


def is_cold_chain_schedule(schedule: ScheduleClass | str | None) -> bool:
    # Catalogue.cold-chain category is identified by schedule on a per-row
    # basis. For Phase 3 we treat ScheduleClass alone as a proxy — products
    # in the cold-chain category will be flagged by services/cart.py via
    # explicit category_slug check; this helper is here for future expansion.
    return False


# ---------------------------------------------------------------------------
# Coupon math
# ---------------------------------------------------------------------------
def coupon_discount(coupon: Coupon | None, subtotal: int) -> int:
    """Returns the discount in paise. Caller should check `is_coupon_eligible`
    first to know whether the coupon actually applies (min_order, expiry, etc.).
    """
    if coupon is None:
        return 0
    if coupon.type == CouponType.percent:
        # Integer-safe percent: 10% of 12,345 paise = 1,234 paise
        return (subtotal * coupon.value) // 100
    # flat (paise) — never below 0, never exceed subtotal
    return min(max(0, coupon.value), subtotal)


def is_coupon_eligible(coupon: Coupon | None, subtotal: int) -> tuple[bool, str | None]:
    """Returns (eligible, reason_if_not). subtotal is in paise."""
    if coupon is None:
        return False, "coupon not found"
    if not coupon.is_active:
        return False, "coupon disabled"
    if coupon.expires_at is not None and coupon.expires_at < datetime.now(timezone.utc):
        return False, "coupon expired"
    if coupon.max_uses is not None and coupon.used_count >= coupon.max_uses:
        return False, "coupon usage limit reached"
    if subtotal < coupon.min_order:
        return False, f"minimum order ₹{coupon.min_order / 100:,.0f} not met"
    return True, None
