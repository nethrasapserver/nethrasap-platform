"""Wishlist + compare tray — server-side saved items per user.

Revision ID: 0011_wishlist_compare
Revises: 0010_hr
Create Date: 2026-07-19
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0011_wishlist_compare"
down_revision: str | Sequence[str] | None = "0010_hr"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _uuid():
    return postgresql.UUID(as_uuid=True)


UUID_PK = dict(primary_key=True, server_default=sa.text("gen_random_uuid()"))


def upgrade() -> None:
    op.create_table(
        "wishlist_items",
        sa.Column("id", _uuid(), **UUID_PK),
        sa.Column("user_id", _uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "product_id", _uuid(), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("user_id", "product_id", name="uq_wishlist_items_user_id_product_id"),
    )
    op.create_index("ix_wishlist_items_user_id", "wishlist_items", ["user_id"])
    op.create_index("ix_wishlist_items_product_id", "wishlist_items", ["product_id"])

    op.create_table(
        "compare_items",
        sa.Column("id", _uuid(), **UUID_PK),
        sa.Column("user_id", _uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "product_id", _uuid(), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("user_id", "product_id", name="uq_compare_items_user_id_product_id"),
    )
    op.create_index("ix_compare_items_user_id", "compare_items", ["user_id"])
    op.create_index("ix_compare_items_product_id", "compare_items", ["product_id"])


def downgrade() -> None:
    op.drop_table("compare_items")
    op.drop_table("wishlist_items")
