"""B6: sales org — assignments + targets.

Revision ID: 0009_sales_org
Revises: 0008_enq_chat_notif
Create Date: 2026-07-11
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0009_sales_org"
down_revision: str | Sequence[str] | None = "0008_enq_chat_notif"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _uuid():
    return postgresql.UUID(as_uuid=True)


UUID_PK = dict(primary_key=True, server_default=sa.text("gen_random_uuid()"))


def upgrade() -> None:
    op.create_table(
        "sales_assignments",
        sa.Column("id", _uuid(), **UUID_PK),
        sa.Column("customer_id", _uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rep_id", _uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("customer_id", "rep_id", "started_at", name="uq_sales_assignment_span"),
    )
    op.create_index("ix_sales_assignments_customer_id", "sales_assignments", ["customer_id"])
    op.create_index("ix_sales_assignments_rep_id", "sales_assignments", ["rep_id"])
    # At most one active assignment per customer.
    op.create_index(
        "uq_sales_assignment_active_customer",
        "sales_assignments",
        ["customer_id"],
        unique=True,
        postgresql_where=sa.text("ended_at IS NULL"),
    )

    op.create_table(
        "sales_targets",
        sa.Column("id", _uuid(), **UUID_PK),
        sa.Column("rep_id", _uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("period", sa.Date(), nullable=False),
        sa.Column("target_paise", sa.BigInteger(), nullable=False),
        sa.Column("label", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("rep_id", "period", name="uq_sales_target_rep_period"),
    )
    op.create_index("ix_sales_targets_rep_id", "sales_targets", ["rep_id"])


def downgrade() -> None:
    op.drop_table("sales_targets")
    op.drop_index("uq_sales_assignment_active_customer", table_name="sales_assignments")
    op.drop_table("sales_assignments")
