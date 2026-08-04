"""Seed the CMS blocks that 0020 missed, so every rendered section is editable.

0020 seeded most of home/about, but the storefront still fell back to in-code
DEFAULTS for several sections — which meant those sections showed as *empty* in
the dashboard editor even though they render on the site. Seed them, verbatim
from the storefront defaults, so admins can edit the live content:

    home   section_heading (category, featured, buyers), section_intro (about, faq), cta_band (1)
    about  about_hero (1), stat (4), story_para (3),
           section_intro (story, operate, founders, network, network_foot, compliance),
           section_heading (principles), cta_band (1)

Source of every value:
    apps/storefront/lib/content.ts           -> DEFAULT_HOME_HEADINGS/INTROS/CTA,
                                                DEFAULT_STATS/STORY_PARAS/ABOUT_CTA,
                                                DEFAULT_ABOUT_HEADINGS/INTROS
    apps/storefront/app/about/page.tsx        -> about_hero default (eyebrow/title/body/cta/facts)

Idempotent PER KIND: a kind is only seeded on a page that currently has zero
blocks of that kind, so hand-added blocks and 0020's blocks are never touched or
duplicated. sort_order follows list order within each kind. downgrade() removes
only the kinds this migration adds, on home/about.

Revision ID: 0021_seed_cms_remaining
Revises: 0020_seed_cms_content
Create Date: 2026-08-04
"""
from __future__ import annotations

import json
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0021_seed_cms_remaining"
down_revision: str | Sequence[str] | None = "0020_seed_cms_content"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# --- Content, grouped {slug: [(kind, [content, ...]), ...]} ------------------

HOME: list[tuple[str, list[dict]]] = [
    (
        "section_heading",
        [
            {"slot": "category", "heading": "Shop by category", "link_label": "All categories →", "link_href": "/categories"},
            {"slot": "featured", "heading": "Featured Products", "link_href": "/products"},
            {"slot": "buyers", "heading": "Built for how you buy"},
        ],
    ),
    (
        "section_intro",
        [
            {
                "slot": "about",
                "eyebrow": "About Nethrasap",
                "heading": "Every box we ship can be traced back to the maker.",
                "body": "We're a licensed healthcare distributor supplying pharmacies, clinics and hospitals across India. Here's what actually happens between the manufacturer and your shelf.",
            },
            {
                "slot": "faq",
                "eyebrow": "Questions",
                "heading": "Frequently asked",
                "body": "Ordering, verification and delivery — the things buyers ask us most.",
            },
        ],
    ),
    (
        "cta_band",
        [
            {
                "eyebrow": "Get verified",
                "heading": "Unlock wholesale pricing on your next order.",
                "body": "One document is all it takes. You can keep ordering at standard pricing while our team reviews it — nothing is blocked while you wait.",
                "cta_label": "Create your account",
                "cta_href": "/signup",
                "alt_label": "Browse the catalogue",
                "alt_href": "/products",
            }
        ],
    ),
]

ABOUT: list[tuple[str, list[dict]]] = [
    (
        "about_hero",
        [
            {
                "eyebrow": "About Nethrasap",
                "title": "India's audited healthcare supply chain, built for the people who run it.",
                "body": "Nethrasap is one licensed source for prescription medicines, OTC, devices and cold-chain biologics — supplying retail pharmacies, clinicians and homes across India. Every box we ship can be traced back to the maker.",
                "cta_label": "Browse products",
                "cta_href": "/products",
                "alt_label": "Register your business",
                "alt_href": "/signup",
                "facts": ["CDSCO-verified sourcing", "GDP cold chain, 2–8°C", "Pan-India delivery"],
            }
        ],
    ),
    (
        "stat",
        [
            {"value": "{{products}}", "label": "Products stocked"},
            {"value": "{{categories}}", "label": "Categories"},
            {"value": "2–8°C", "label": "Cold chain, logged"},
            {"value": "100%", "label": "Batch traceable"},
        ],
    ),
    (
        "story_para",
        [
            {"text": "Anyone who has run a pharmacy counter in India knows the feeling — a carton arrives from the third distributor this month, the invoice doesn't match the batch, and there is no way to know how it was stored on the way. The supply chain worked, but nobody could prove it."},
            {"text": "We started Nethrasap to make the proof part of the product. One warehouse, one promise: every unit logged to its manufacturer batch on arrival, every cold-chain handover recorded, every invoice matching what's physically in the box."},
            {"text": "Today that same discipline runs a full platform — wholesale slabs for verified retailers, clinician pricing for practices and hospitals, transparent MRP for households, and negotiable quotes for bulk buying. Different buyers, one audited chain behind all of them."},
        ],
    ),
    (
        "section_heading",
        [{"slot": "principles", "heading": "What we stand for"}],
    ),
    (
        "section_intro",
        [
            {"slot": "story", "eyebrow": "Our story", "heading": "It started with one question: where did this box come from?", "body": ""},
            {"slot": "operate", "eyebrow": "How we operate", "heading": "Four steps, no shortcuts.", "body": "The journey every single box takes — whether it's one strip or one pallet."},
            {"slot": "founders", "eyebrow": "The founders", "heading": "Three people who got tired of unverifiable boxes.", "body": ""},
            {"slot": "network", "eyebrow": "Where we operate", "heading": "Six facilities. One audited network.", "body": "Stock moves between our hubs under the same batch log it arrived with — wherever you are, the paper trail travels with the box."},
            {"slot": "network_foot", "eyebrow": "", "heading": "", "body": "Registered office: Nethrasap Healthcare Supply Pvt. Ltd., Chennai, Tamil Nadu · Support: +91 44 4000 0000 (placeholder)"},
            {"slot": "compliance", "eyebrow": "Compliance", "heading": "", "body": "Licence and certification documents are available on request for verified business buyers."},
        ],
    ),
    (
        "cta_band",
        [
            {
                "eyebrow": "Buy the audited way",
                "heading": "One verified account. Every category on one invoice.",
                "body": "Keep ordering at standard pricing while our team verifies your documents — nothing is blocked while you wait.",
                "cta_label": "Create your account",
                "cta_href": "/signup",
                "alt_label": "Explore the catalogue",
                "alt_href": "/products",
            }
        ],
    ),
]

PAGES: list[tuple[str, list[tuple[str, list[dict]]]]] = [("home", HOME), ("about", ABOUT)]

_INSERT_BLOCK = sa.text(
    """
    INSERT INTO cms_blocks (id, page_id, kind, sort_order, is_active, content, created_at, updated_at)
    VALUES (gen_random_uuid(), :page_id, :kind, :sort_order, true, CAST(:content AS jsonb), now(), now())
    """
)


def upgrade() -> None:
    bind = op.get_bind()
    for slug, groups in PAGES:
        page = bind.execute(sa.text("SELECT id FROM cms_pages WHERE slug = :slug"), {"slug": slug}).first()
        if page is None:
            continue  # page not seeded yet (0020 owns creation)
        page_id = page[0]
        for kind, contents in groups:
            already = bind.execute(
                sa.text("SELECT 1 FROM cms_blocks WHERE page_id = :pid AND kind = :kind LIMIT 1"),
                {"pid": page_id, "kind": kind},
            ).first()
            if already is not None:
                continue  # kind already has blocks — leave it untouched
            for sort_order, content in enumerate(contents):
                bind.execute(
                    _INSERT_BLOCK,
                    {
                        "page_id": page_id,
                        "kind": kind,
                        "sort_order": sort_order,
                        "content": json.dumps(content, ensure_ascii=False),
                    },
                )


def downgrade() -> None:
    bind = op.get_bind()
    added = {
        "home": ["section_heading", "section_intro", "cta_band"],
        "about": ["about_hero", "stat", "story_para", "section_heading", "section_intro", "cta_band"],
    }
    for slug, kinds in added.items():
        bind.execute(
            sa.text(
                "DELETE FROM cms_blocks WHERE kind = ANY(:kinds) AND page_id = "
                "(SELECT id FROM cms_pages WHERE slug = :slug)"
            ),
            {"kinds": kinds, "slug": slug},
        )
