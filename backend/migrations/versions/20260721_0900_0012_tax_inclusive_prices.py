"""Prices become tax-inclusive (MRP style).

Indian retail listings must show a price inclusive of all taxes, so
`product_prices.mrp` / `.selling_price` now *contain* GST rather than having it
added at checkout (see services/pricing.gst_within).

Existing rows are tax-exclusive, so they are grossed up by the product's GST
rate. That deliberately preserves the seller's net revenue: a ₹85 ex-GST item at
12% becomes ₹95.20 inclusive, and the merchant still nets ₹85. The alternative —
reinterpreting stored prices as already-inclusive — would have silently cut every
price by the tax amount.

Historic orders are untouched: they snapshot their own unit prices and totals.

Revision ID: 0012_tax_inclusive_prices
Revises: 0011_wishlist_compare
Create Date: 2026-07-21
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0012_tax_inclusive_prices"
down_revision: str | Sequence[str] | None = "0011_wishlist_compare"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# ROUND_HALF_UP gross-up: price * (100 + rate) / 100
_GROSS_UP = """
UPDATE product_prices AS pp
   SET mrp           = (2 * pp.mrp           * (100 + p.gst_rate_pct) + 100) / 200,
       selling_price = (2 * pp.selling_price * (100 + p.gst_rate_pct) + 100) / 200,
       updated_at    = NOW()
  FROM product_variants v
  JOIN products p ON p.id = v.product_id
 WHERE pp.variant_id = v.id
"""

# Inverse: price * 100 / (100 + rate)
_NET_DOWN = """
UPDATE product_prices AS pp
   SET mrp           = (2 * pp.mrp           * 100 + (100 + p.gst_rate_pct))
                       / (2 * (100 + p.gst_rate_pct)),
       selling_price = (2 * pp.selling_price * 100 + (100 + p.gst_rate_pct))
                       / (2 * (100 + p.gst_rate_pct)),
       updated_at    = NOW()
  FROM product_variants v
  JOIN products p ON p.id = v.product_id
 WHERE pp.variant_id = v.id
"""


def upgrade() -> None:
    op.execute(_GROSS_UP)


def downgrade() -> None:
    op.execute(_NET_DOWN)
