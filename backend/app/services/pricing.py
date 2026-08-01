"""Central money math — every total computed in paise (integer)."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

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
    unit_price: int      # paise, TAX-INCLUSIVE (the price the customer sees)
    gst_rate_pct: int
    subtotal: int        # paise: taxable value = line_total - gst_amount
    gst_amount: int      # paise: GST contained *within* line_total
    line_total: int      # paise: quantity * unit_price


def gst_within(inclusive_amount: int, gst_rate_pct: int | None = None) -> int:
    """GST contained inside a tax-inclusive amount.

    Prices on this platform are MRP-style — inclusive of all taxes, as Indian
    retail listings must be — so tax is *extracted*, never added:

        gst = amount x rate / (100 + rate)

    Integer paise with ROUND_HALF_UP (Indian invoicing convention); the x2 form
    avoids the fractional half-divisor that plain floor division would truncate.
    """
    rate = gst_rate_pct if gst_rate_pct is not None else DEFAULT_GST_RATE_PCT
    if inclusive_amount <= 0 or rate <= 0:
        return 0
    return (2 * inclusive_amount * rate + (100 + rate)) // (2 * (100 + rate))


def gst_on_taxable(taxable_amount: int, gst_rate_pct: int | None = None) -> int:
    """GST as a percentage *of* an already tax-EXCLUSIVE taxable value.

    The additive counterpart of `gst_within`: where `gst_within` extracts tax
    contained inside an inclusive price, this adds tax onto a bare taxable base

        gst = taxable x rate / 100

    For an undiscounted line the two agree exactly (taxable = inclusive x 100 /
    (100 + rate), so taxable x rate/100 == inclusive x rate/(100+rate)); this
    helper exists for the order level, where an invoice discount (s.15(3) CGST)
    reduces the taxable base and GST must be recomputed on the reduced value.
    Integer paise, ROUND_HALF_UP — same convention as `gst_within`.
    """
    rate = gst_rate_pct if gst_rate_pct is not None else DEFAULT_GST_RATE_PCT
    if taxable_amount <= 0 or rate <= 0:
        return 0
    return (2 * taxable_amount * rate + 100) // 200


def compute_line(quantity: int, unit_price: int, gst_rate_pct: int | None) -> LineMath:
    """`unit_price` is tax-inclusive; the customer pays quantity x unit_price."""
    if quantity < 1:
        raise ValueError("quantity must be >= 1")
    if unit_price < 0:
        raise ValueError("unit_price must be >= 0")
    rate = gst_rate_pct if gst_rate_pct is not None else DEFAULT_GST_RATE_PCT
    line_total = quantity * unit_price
    gst_amount = gst_within(line_total, rate)
    # Taxable value for the GST invoice — grand totals stay
    # `subtotal + gst`, so every downstream caller keeps working.
    subtotal = line_total - gst_amount
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
    if coupon.expires_at is not None and coupon.expires_at < datetime.now(UTC):
        return False, "coupon expired"
    if coupon.max_uses is not None and coupon.used_count >= coupon.max_uses:
        return False, "coupon usage limit reached"
    if subtotal < coupon.min_order:
        return False, f"minimum order ₹{coupon.min_order / 100:,.0f} not met"
    return True, None
