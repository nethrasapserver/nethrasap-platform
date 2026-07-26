"""Indicative price range for the quote (RFQ) model.

`product_prices` gains `range_min` / `range_max` (tax-inclusive paise, nullable).
When `range_max > range_min` the product is quote-only: the catalogue shows the
band, buying raises an enquiry, and the rep quotes the firm price. NULL leaves a
product fixed-price — it still checks out directly at `selling_price` (hybrid
model, owner decision 2026-07-21).

Existing rows stay NULL → every current product remains fixed-price. No behaviour
changes until ops sets a range on a product.

Revision ID: 0013_price_range
Revises: 0012_tax_inclusive_prices
Create Date: 2026-07-21
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013_price_range"
down_revision: str | Sequence[str] | None = "0012_tax_inclusive_prices"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("product_prices", sa.Column("range_min", sa.Integer(), nullable=True))
    op.add_column("product_prices", sa.Column("range_max", sa.Integer(), nullable=True))
    # A range, when present, must be a real band and non-negative.
    op.create_check_constraint(
        "ck_product_prices_range_valid",
        "product_prices",
        "(range_min IS NULL AND range_max IS NULL) OR "
        "(range_min IS NOT NULL AND range_max IS NOT NULL "
        " AND range_min >= 0 AND range_max >= range_min)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_product_prices_range_valid", "product_prices", type_="check")
    op.drop_column("product_prices", "range_max")
    op.drop_column("product_prices", "range_min")
