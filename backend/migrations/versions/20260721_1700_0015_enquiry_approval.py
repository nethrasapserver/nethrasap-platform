"""Quote approval workflow — internal sign-off before a quote reaches the customer.

Adds an approval state + audit columns to enquiries, and a new
`enquiries:approve` permission granted to manager and admin roles (sales can
draft a quote but cannot release it).

Revision ID: 0015_enquiry_approval
Revises: 0014_pincodes
Create Date: 2026-07-21
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0015_enquiry_approval"
down_revision: str | Sequence[str] | None = "0014_pincodes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    enquiry_approval = sa.Enum(
        "none", "pending", "approved", "returned", name="enquiry_approval"
    )
    enquiry_approval.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "enquiries",
        sa.Column(
            "approval_status",
            enquiry_approval,
            nullable=False,
            server_default="none",
        ),
    )
    op.add_column("enquiries", sa.Column("quote_prepared_by_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("enquiries", sa.Column("quote_approved_by_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("enquiries", sa.Column("quote_submitted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("enquiries", sa.Column("quote_approved_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        "fk_enquiries_quote_prepared_by", "enquiries", "users",
        ["quote_prepared_by_id"], ["id"], ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_enquiries_quote_approved_by", "enquiries", "users",
        ["quote_approved_by_id"], ["id"], ondelete="SET NULL",
    )
    op.create_index("ix_enquiries_approval_status", "enquiries", ["approval_status"])

    # Any quote already sent to a customer was implicitly approved under the old
    # (no-review) flow — mark it so it doesn't reappear as "awaiting approval".
    op.execute(
        "UPDATE enquiries SET approval_status = 'approved' "
        "WHERE status IN ('quoted', 'confirmed', 'converted')"
    )

    # New permission + role grants (manager, admin). Guarded so re-runs are safe
    # and it matches whatever the seed would produce on a fresh install.
    op.execute(
        """
        INSERT INTO permissions (id, resource, action, description)
        SELECT gen_random_uuid(), 'enquiries', 'approve', 'Approve and release drafted quotes'
        WHERE NOT EXISTS (
            SELECT 1 FROM permissions WHERE resource = 'enquiries' AND action = 'approve'
        )
        """
    )
    op.execute(
        """
        INSERT INTO role_permissions (id, role_id, permission_id)
        SELECT gen_random_uuid(), r.id, p.id
        FROM roles r
        CROSS JOIN permissions p
        WHERE r.name IN ('manager', 'admin')
          AND p.resource = 'enquiries' AND p.action = 'approve'
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM role_permissions rp
        USING permissions p
        WHERE rp.permission_id = p.id
          AND p.resource = 'enquiries' AND p.action = 'approve'
        """
    )
    op.execute("DELETE FROM permissions WHERE resource = 'enquiries' AND action = 'approve'")

    op.drop_index("ix_enquiries_approval_status", table_name="enquiries")
    op.drop_constraint("fk_enquiries_quote_approved_by", "enquiries", type_="foreignkey")
    op.drop_constraint("fk_enquiries_quote_prepared_by", "enquiries", type_="foreignkey")
    op.drop_column("enquiries", "quote_approved_at")
    op.drop_column("enquiries", "quote_submitted_at")
    op.drop_column("enquiries", "quote_approved_by_id")
    op.drop_column("enquiries", "quote_prepared_by_id")
    op.drop_column("enquiries", "approval_status")
    sa.Enum(name="enquiry_approval").drop(op.get_bind(), checkfirst=True)
