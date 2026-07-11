"""Reviews table + denorm trigger + functional sub_category index.

Revision ID: 0002_reviews_and_filters
Revises: 0001_initial_schema
Create Date: 2026-05-20
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_reviews_and_filters"
down_revision: str | Sequence[str] | None = "0001_initial_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- reviews table ----------------------------------------------------
    op.create_table(
        "reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="CASCADE", name="fk_reviews_product_id_products"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE", name="fk_reviews_user_id_users"),
            nullable=False,
        ),
        sa.Column("rating", sa.SmallInteger, nullable=False),
        sa.Column("title", sa.String(120)),
        sa.Column("body", sa.Text),
        sa.Column(
            "is_verified_purchase",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.CheckConstraint(
            "rating BETWEEN 1 AND 5", name="ck_reviews_rating_range"
        ),
        sa.UniqueConstraint(
            "user_id", "product_id", name="uq_reviews_user_id_product_id"
        ),
    )
    op.create_index("ix_reviews_product_id", "reviews", ["product_id"])
    op.create_index("ix_reviews_user_id", "reviews", ["user_id"])
    op.create_index(
        "ix_reviews_product_id_created_at",
        "reviews",
        ["product_id", "created_at"],
    )

    # --- denorm trigger: refresh products.rating + reviews_count ----------
    op.execute(
        """
        CREATE OR REPLACE FUNCTION reviews_recompute_product()
        RETURNS trigger AS $$
        DECLARE
          target_product_id uuid := COALESCE(NEW.product_id, OLD.product_id);
        BEGIN
          UPDATE products p
             SET rating = COALESCE(
                   (SELECT ROUND(AVG(r.rating)::numeric, 2)
                    FROM reviews r WHERE r.product_id = target_product_id),
                   0),
                 reviews_count = (
                   SELECT COUNT(*) FROM reviews r WHERE r.product_id = target_product_id),
                 updated_at = NOW()
           WHERE p.id = target_product_id;
          RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER reviews_recompute_aiud
          AFTER INSERT OR UPDATE OR DELETE ON reviews
          FOR EACH ROW EXECUTE FUNCTION reviews_recompute_product();
        """
    )

    # --- functional index for case-insensitive sub_category filter --------
    op.execute(
        "CREATE INDEX ix_products_sub_category_lower ON products (LOWER(sub_category))"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_products_sub_category_lower")
    op.execute("DROP TRIGGER IF EXISTS reviews_recompute_aiud ON reviews")
    op.execute("DROP FUNCTION IF EXISTS reviews_recompute_product()")

    op.drop_index("ix_reviews_product_id_created_at", table_name="reviews")
    op.drop_index("ix_reviews_user_id", table_name="reviews")
    op.drop_index("ix_reviews_product_id", table_name="reviews")
    op.drop_table("reviews")
