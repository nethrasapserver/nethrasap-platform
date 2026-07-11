"""Phone-first identity: drop email, require unique phone, add otp_codes.

The platform has no email flows at all — phone (E.164) is the identity key
and OTP over SMS is the verification channel.

Revision ID: 0004_phone_first_identity
Revises: 0003_cart_orders_payments
Create Date: 2026-07-11
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_phone_first_identity"
down_revision: str | Sequence[str] | None = "0003_cart_orders_payments"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OTP_PURPOSE = ("signup", "login", "reset")


def upgrade() -> None:
    # --- users: email out, phone becomes the mandatory identity ------------
    # Pre-production dataset: any row without a phone cannot be migrated to a
    # phone-first identity and is removed (demo/seed accounts only).
    op.execute("DELETE FROM users WHERE phone IS NULL")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_column("users", "email")
    op.drop_column("users", "email_verified_at")
    op.alter_column(
        "users",
        "phone",
        existing_type=sa.String(32),
        type_=sa.String(20),
        nullable=False,
    )

    # --- otp_codes ----------------------------------------------------------
    otp_purpose = postgresql.ENUM(*OTP_PURPOSE, name="otp_purpose", create_type=True)
    otp_purpose.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "otp_codes",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column(
            "purpose",
            postgresql.ENUM(*OTP_PURPOSE, name="otp_purpose", create_type=False),
            nullable=False,
        ),
        sa.Column("code_hash", sa.String(128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_otp_codes_phone_purpose", "otp_codes", ["phone", "purpose"])


def downgrade() -> None:
    op.drop_index("ix_otp_codes_phone_purpose", table_name="otp_codes")
    op.drop_table("otp_codes")
    op.execute("DROP TYPE IF EXISTS otp_purpose")

    op.alter_column(
        "users",
        "phone",
        existing_type=sa.String(20),
        type_=sa.String(32),
        nullable=True,
    )
    op.add_column("users", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))
    # Emails cannot be recovered; backfill with a placeholder to satisfy NOT NULL.
    op.add_column("users", sa.Column("email", sa.String(255), nullable=True))
    op.execute("UPDATE users SET email = phone || '@placeholder.invalid'")
    op.alter_column("users", "email", existing_type=sa.String(255), nullable=False)
    op.create_index("ix_users_email", "users", ["email"], unique=True)
