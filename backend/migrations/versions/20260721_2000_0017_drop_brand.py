"""Remove the product brand concept entirely.

Rebuilds the products search trigger without brand, drops the brand column, and
relaxes order_items.brand_snapshot (historical snapshots kept, no longer
populated for new lines).

Revision ID: 0017_drop_brand
Revises: 0016_manager_catalogue
Create Date: 2026-07-21
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0017_drop_brand"
down_revision: str | Sequence[str] | None = "0016_manager_catalogue"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # The trigger references NEW.brand and lists brand in its OF clause — rebuild
    # both before the column can be dropped.
    op.execute("DROP TRIGGER IF EXISTS products_tsv_update ON products")
    op.execute(
        """
        CREATE OR REPLACE FUNCTION products_tsv_trigger()
        RETURNS trigger AS $$
        BEGIN
          NEW.search_tsv :=
            setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C');
          RETURN NEW;
        END
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER products_tsv_update
          BEFORE INSERT OR UPDATE OF name, description ON products
          FOR EACH ROW EXECUTE FUNCTION products_tsv_trigger();
        """
    )

    op.drop_index("ix_products_brand", table_name="products")
    op.drop_column("products", "brand")

    # New order lines no longer carry a brand snapshot.
    op.alter_column("order_items", "brand_snapshot", existing_type=sa.String(120), nullable=True)


def downgrade() -> None:
    op.add_column("products", sa.Column("brand", sa.String(120), nullable=False, server_default=""))
    op.alter_column("products", "brand", server_default=None)
    op.create_index("ix_products_brand", "products", ["brand"])
    op.alter_column("order_items", "brand_snapshot", existing_type=sa.String(120), nullable=False, server_default="")

    op.execute("DROP TRIGGER IF EXISTS products_tsv_update ON products")
    op.execute(
        """
        CREATE OR REPLACE FUNCTION products_tsv_trigger()
        RETURNS trigger AS $$
        BEGIN
          NEW.search_tsv :=
            setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(NEW.brand, '')), 'B') ||
            setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C');
          RETURN NEW;
        END
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER products_tsv_update
          BEFORE INSERT OR UPDATE OF name, brand, description ON products
          FOR EACH ROW EXECUTE FUNCTION products_tsv_trigger();
        """
    )
