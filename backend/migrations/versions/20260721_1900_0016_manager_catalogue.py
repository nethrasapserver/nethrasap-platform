"""Grant catalogue:write to managers — product & category CRUD is a manager
duty, not admin-only.

Revision ID: 0016_manager_catalogue
Revises: 0015_enquiry_approval
Create Date: 2026-07-21
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0016_manager_catalogue"
down_revision: str | Sequence[str] | None = "0015_enquiry_approval"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO role_permissions (id, role_id, permission_id)
        SELECT gen_random_uuid(), r.id, p.id
        FROM roles r
        CROSS JOIN permissions p
        WHERE r.name = 'manager'
          AND p.resource = 'catalogue' AND p.action = 'write'
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
        USING roles r, permissions p
        WHERE rp.role_id = r.id AND rp.permission_id = p.id
          AND r.name = 'manager'
          AND p.resource = 'catalogue' AND p.action = 'write'
        """
    )
