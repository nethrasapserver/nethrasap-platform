"""Seed the global site_logo CMS block so the header wordmark/logo is editable.

Adds one site_logo block on the global surface holding the header brand:

    {image: "", text: "Nethra", accent: "sap"}

The storefront header shows the uploaded `image` when set, otherwise the
`text` + coloured `accent` wordmark (apps/storefront/components/Shell.tsx via
siteLogo() in lib/content.ts).

Idempotent: only seeds when the global page has no site_logo block, so a hand
edit is never overwritten or duplicated. downgrade() removes it.

Revision ID: 0023_seed_site_logo
Revises: 0022_seed_site_text
Create Date: 2026-08-04
"""
from __future__ import annotations

import json
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0023_seed_site_logo"
down_revision: str | Sequence[str] | None = "0022_seed_site_text"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

LOGO = {"image": "", "text": "Nethra", "accent": "sap"}


def upgrade() -> None:
    bind = op.get_bind()
    page = bind.execute(sa.text("SELECT id FROM cms_pages WHERE slug = 'global'")).first()
    if page is None:
        return
    page_id = page[0]
    already = bind.execute(
        sa.text("SELECT 1 FROM cms_blocks WHERE page_id = :pid AND kind = 'site_logo' LIMIT 1"),
        {"pid": page_id},
    ).first()
    if already is not None:
        return
    bind.execute(
        sa.text(
            """
            INSERT INTO cms_blocks (id, page_id, kind, sort_order, is_active, content, created_at, updated_at)
            VALUES (gen_random_uuid(), :page_id, 'site_logo', 0, true, CAST(:content AS jsonb), now(), now())
            """
        ),
        {"page_id": page_id, "content": json.dumps(LOGO, ensure_ascii=False)},
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            "DELETE FROM cms_blocks WHERE kind = 'site_logo' AND page_id IN "
            "(SELECT id FROM cms_pages WHERE slug = 'global')"
        )
    )
