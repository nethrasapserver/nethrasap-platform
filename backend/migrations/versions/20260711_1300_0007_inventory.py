"""Inventory: warehouses, stock_levels, stock_ledger (+ default MAIN warehouse).

Revision ID: 0007_inventory
Revises: 0006_cms_settings_flags
Create Date: 2026-07-11
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007_inventory"
down_revision: str | Sequence[str] | None = "0006_cms_settings_flags"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

STOCK_MOVEMENT = ("receipt", "reservation", "release", "fulfillment", "adjustment", "return")


def upgrade() -> None:
    stock_movement = postgresql.ENUM(*STOCK_MOVEMENT, name="stock_movement")
    stock_movement.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "warehouses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("code", sa.String(20), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("state", sa.String(100), nullable=True),
        sa.Column("pincode", sa.String(10), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_warehouses_code", "warehouses", ["code"], unique=True)

    op.create_table(
        "stock_levels",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "variant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("product_variants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "warehouse_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("warehouses.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("on_hand", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reserved", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reorder_point", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("variant_id", "warehouse_id", name="uq_stock_levels_variant_warehouse"),
        sa.CheckConstraint("on_hand >= 0", name="ck_stock_levels_on_hand_nonneg"),
        sa.CheckConstraint("reserved >= 0", name="ck_stock_levels_reserved_nonneg"),
        sa.CheckConstraint("reserved <= on_hand", name="ck_stock_levels_reserved_le_on_hand"),
    )
    op.create_index("ix_stock_levels_variant", "stock_levels", ["variant_id"])

    op.create_table(
        "stock_ledger",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "variant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("product_variants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "warehouse_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("warehouses.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "movement",
            postgresql.ENUM(*STOCK_MOVEMENT, name="stock_movement", create_type=False),
            nullable=False,
        ),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(120), nullable=True),
        sa.Column("ref_type", sa.String(40), nullable=True),
        sa.Column("ref_id", sa.String(64), nullable=True),
        sa.Column(
            "actor_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_stock_ledger_variant", "stock_ledger", ["variant_id"])
    op.create_index("ix_stock_ledger_ref", "stock_ledger", ["ref_type", "ref_id"])

    # Default fulfilment warehouse so the service always has a target.
    op.execute(
        "INSERT INTO warehouses (code, name, city, state) "
        "VALUES ('MAIN', 'Main Warehouse', 'Chennai', 'Tamil Nadu')"
    )


def downgrade() -> None:
    op.drop_table("stock_ledger")
    op.drop_table("stock_levels")
    op.drop_table("warehouses")
    op.execute("DROP TYPE IF EXISTS stock_movement")
