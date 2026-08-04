"""Seed site_text CMS blocks so the scattered global/home strings are editable.

Adds one site_text{slot,value} block per string, verbatim from the storefront
SITE_TEXT defaults (apps/storefront/lib/content.ts):

    global  search_placeholder, buybox_shipping, buybox_tax, categories_heading,
            categories_intro, seo_title, seo_description
    home    home_foot_stat_label/value, home_foot_cta_label/href,
            home_foot_alt_label/href  (the home "about" footer figures + buttons)

Idempotent: only seeds site_text on a page that currently has none, so hand
edits are never touched or duplicated. downgrade() removes site_text on both.

Revision ID: 0022_seed_site_text
Revises: 0021_seed_cms_remaining
Create Date: 2026-08-04
"""
from __future__ import annotations

import json
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0022_seed_site_text"
down_revision: str | Sequence[str] | None = "0021_seed_cms_remaining"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


GLOBAL_TEXT: list[tuple[str, str]] = [
    ("search_placeholder", "Search medicines, devices…"),
    ("buybox_shipping", "Free shipping on orders above ₹499 · COD available"),
    ("buybox_tax", "Inclusive of all taxes"),
    ("categories_heading", "Shop by category"),
    ("categories_intro", "Browse the full audited range by department."),
    ("seo_title", "Nethrasap — India's audited healthcare supply platform"),
    (
        "seo_description",
        "Wholesale and retail pharmaceutical & healthcare supplies for clinicians, retailers and consumers across India.",
    ),
]

HOME_TEXT: list[tuple[str, str]] = [
    ("home_foot_stat_label", "Cold chain"),
    ("home_foot_stat_value", "2–8°C"),
    ("home_foot_cta_label", "Register your business"),
    ("home_foot_cta_href", "/signup"),
    ("home_foot_alt_label", "Explore the catalogue"),
    ("home_foot_alt_href", "/products"),
]

PAGES: list[tuple[str, list[tuple[str, str]]]] = [("global", GLOBAL_TEXT), ("home", HOME_TEXT)]

_INSERT_BLOCK = sa.text(
    """
    INSERT INTO cms_blocks (id, page_id, kind, sort_order, is_active, content, created_at, updated_at)
    VALUES (gen_random_uuid(), :page_id, 'site_text', :sort_order, true, CAST(:content AS jsonb), now(), now())
    """
)


def upgrade() -> None:
    bind = op.get_bind()
    for slug, items in PAGES:
        page = bind.execute(sa.text("SELECT id FROM cms_pages WHERE slug = :slug"), {"slug": slug}).first()
        if page is None:
            continue
        page_id = page[0]
        already = bind.execute(
            sa.text("SELECT 1 FROM cms_blocks WHERE page_id = :pid AND kind = 'site_text' LIMIT 1"),
            {"pid": page_id},
        ).first()
        if already is not None:
            continue
        for sort_order, (slot, value) in enumerate(items):
            bind.execute(
                _INSERT_BLOCK,
                {
                    "page_id": page_id,
                    "sort_order": sort_order,
                    "content": json.dumps({"slot": slot, "value": value}, ensure_ascii=False),
                },
            )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            "DELETE FROM cms_blocks WHERE kind = 'site_text' AND page_id IN "
            "(SELECT id FROM cms_pages WHERE slug IN ('global', 'home'))"
        )
    )
