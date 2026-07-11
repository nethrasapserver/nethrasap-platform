"""B5: notifications, enquiries (RFQ), chat.

Revision ID: 0008_enquiries_chat_notifications
Revises: 0007_inventory
Create Date: 2026-07-11
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008_enq_chat_notif"
down_revision: str | Sequence[str] | None = "0007_inventory"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NOTIF_TYPE = ("order", "enquiry", "chat", "verification", "system")
NOTIF_PRIORITY = ("low", "normal", "high")
ENQUIRY_STATUS = ("pending", "quoted", "confirmed", "converted", "rejected")
CONVERSATION_STATUS = ("open", "closed")

UUID_PK = dict(primary_key=True, server_default=sa.text("gen_random_uuid()"))


def _uuid():
    return postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    for name, values in [
        ("notification_type", NOTIF_TYPE),
        ("notification_priority", NOTIF_PRIORITY),
        ("enquiry_status", ENQUIRY_STATUS),
        ("conversation_status", CONVERSATION_STATUS),
    ]:
        postgresql.ENUM(*values, name=name).create(op.get_bind(), checkfirst=True)

    ts = lambda **kw: sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,  # noqa: E731
                               server_default=sa.text("now()"), **kw)

    # --- notifications ---------------------------------------------------------
    op.create_table(
        "notifications",
        sa.Column("id", _uuid(), **UUID_PK),
        sa.Column("user_id", _uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", postgresql.ENUM(*NOTIF_TYPE, name="notification_type", create_type=False), nullable=False),
        sa.Column("priority", postgresql.ENUM(*NOTIF_PRIORITY, name="notification_priority", create_type=False),
                  nullable=False, server_default="normal"),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("link", sa.String(255), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        ts(),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])

    # --- enquiries -------------------------------------------------------------
    op.create_table(
        "enquiries",
        sa.Column("id", _uuid(), **UUID_PK),
        sa.Column("reference", sa.String(20), nullable=False),
        sa.Column("customer_id", _uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("assigned_rep_id", _uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", postgresql.ENUM(*ENQUIRY_STATUS, name="enquiry_status", create_type=False),
                  nullable=False, server_default="pending"),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("quoted_subtotal", sa.Integer(), nullable=True),
        sa.Column("quoted_total", sa.Integer(), nullable=True),
        sa.Column("quote_valid_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("converted_order_id", _uuid(), sa.ForeignKey("orders.id", ondelete="SET NULL"), nullable=True),
        ts(),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_enquiries_reference", "enquiries", ["reference"], unique=True)
    op.create_index("ix_enquiries_customer_id", "enquiries", ["customer_id"])
    op.create_index("ix_enquiries_assigned_rep_id", "enquiries", ["assigned_rep_id"])
    op.create_index("ix_enquiries_status", "enquiries", ["status"])

    op.create_table(
        "enquiry_items",
        sa.Column("id", _uuid(), **UUID_PK),
        sa.Column("enquiry_id", _uuid(), sa.ForeignKey("enquiries.id", ondelete="CASCADE"), nullable=False),
        sa.Column("variant_id", _uuid(), sa.ForeignKey("product_variants.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("product_name_snapshot", sa.String(255), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("quoted_unit_price", sa.Integer(), nullable=True),
        ts(),
    )
    op.create_index("ix_enquiry_items_enquiry_id", "enquiry_items", ["enquiry_id"])

    op.create_table(
        "enquiry_messages",
        sa.Column("id", _uuid(), **UUID_PK),
        sa.Column("enquiry_id", _uuid(), sa.ForeignKey("enquiries.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", _uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        ts(),
    )
    op.create_index("ix_enquiry_messages_enquiry_id", "enquiry_messages", ["enquiry_id"])

    op.create_table(
        "enquiry_status_history",
        sa.Column("id", _uuid(), **UUID_PK),
        sa.Column("enquiry_id", _uuid(), sa.ForeignKey("enquiries.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", postgresql.ENUM(*ENQUIRY_STATUS, name="enquiry_status", create_type=False), nullable=False),
        sa.Column("actor_user_id", _uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_enquiry_status_history_enquiry_id", "enquiry_status_history", ["enquiry_id"])

    # --- chat ------------------------------------------------------------------
    op.create_table(
        "conversations",
        sa.Column("id", _uuid(), **UUID_PK),
        sa.Column("customer_id", _uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("assigned_to", _uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", postgresql.ENUM(*CONVERSATION_STATUS, name="conversation_status", create_type=False),
                  nullable=False, server_default="open"),
        sa.Column("subject", sa.String(200), nullable=True),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        ts(),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_conversations_customer_id", "conversations", ["customer_id"])
    op.create_index("ix_conversations_assigned_to", "conversations", ["assigned_to"])
    op.create_index("ix_conversations_status", "conversations", ["status"])
    op.create_index("ix_conversations_last_message_at", "conversations", ["last_message_at"])

    op.create_table(
        "messages",
        sa.Column("id", _uuid(), **UUID_PK),
        sa.Column("conversation_id", _uuid(), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", _uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        ts(),
    )
    op.create_index("ix_messages_conversation_id", "messages", ["conversation_id"])

    op.create_table(
        "message_reads",
        sa.Column("id", _uuid(), **UUID_PK),
        sa.Column("conversation_id", _uuid(), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", _uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("last_read_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("conversation_id", "user_id", name="uq_message_reads_conv_user"),
    )


def downgrade() -> None:
    op.drop_table("message_reads")
    op.drop_table("messages")
    op.drop_table("conversations")
    op.drop_table("enquiry_status_history")
    op.drop_table("enquiry_messages")
    op.drop_table("enquiry_items")
    op.drop_table("enquiries")
    op.drop_table("notifications")
    for name in ("conversation_status", "enquiry_status", "notification_priority", "notification_type"):
        op.execute(f"DROP TYPE IF EXISTS {name}")
