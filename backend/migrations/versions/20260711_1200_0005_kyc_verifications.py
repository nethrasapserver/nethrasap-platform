"""KYC: verification_requests + kyc_documents.

Revision ID: 0005_kyc_verifications
Revises: 0004_phone_first_identity
Create Date: 2026-07-11
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005_kyc_verifications"
down_revision: str | Sequence[str] | None = "0004_phone_first_identity"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

VERIFICATION_STATUS = ("pending", "approved", "rejected")
KYC_DOC_TYPE = ("council_cert", "cdsco_20b_21b", "gstin", "hospital_license")


def upgrade() -> None:
    verification_status = postgresql.ENUM(*VERIFICATION_STATUS, name="verification_status")
    kyc_doc_type = postgresql.ENUM(*KYC_DOC_TYPE, name="kyc_doc_type")
    verification_status.create(op.get_bind(), checkfirst=True)
    kyc_doc_type.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "verification_requests",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(*VERIFICATION_STATUS, name="verification_status", create_type=False),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("credential_no", sa.String(100), nullable=True),
        sa.Column(
            "reviewed_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_verification_requests_user_id", "verification_requests", ["user_id"])
    op.create_index("ix_verification_requests_status", "verification_requests", ["status"])

    op.create_table(
        "kyc_documents",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "request_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("verification_requests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "doc_type",
            postgresql.ENUM(*KYC_DOC_TYPE, name="kyc_doc_type", create_type=False),
            nullable=False,
        ),
        sa.Column("storage_key", sa.String(512), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_kyc_documents_request_id", "kyc_documents", ["request_id"])


def downgrade() -> None:
    op.drop_table("kyc_documents")
    op.drop_table("verification_requests")
    op.execute("DROP TYPE IF EXISTS kyc_doc_type")
    op.execute("DROP TYPE IF EXISTS verification_status")
