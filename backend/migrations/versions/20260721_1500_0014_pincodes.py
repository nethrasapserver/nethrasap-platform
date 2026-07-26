"""Pincode → locality cache for checkout address autofill.

Revision ID: 0014_pincodes
Revises: 0013_price_range
Create Date: 2026-07-21
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0014_pincodes"
down_revision: str | Sequence[str] | None = "0013_price_range"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "pincodes",
        sa.Column("pincode", sa.String(6), primary_key=True),
        sa.Column("city", sa.String(120), nullable=False),
        sa.Column("district", sa.String(120), nullable=False),
        sa.Column("state", sa.String(120), nullable=False),
        sa.Column("source", sa.String(20), nullable=False, server_default="india_post"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("pincodes")
