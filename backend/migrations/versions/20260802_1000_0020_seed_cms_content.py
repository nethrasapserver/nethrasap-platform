"""Seed the storefront CMS with the current hardcoded content, byte-for-byte.

Data-only, idempotent, reversible. Creates three published pages — ``home``,
``about`` and ``global`` — only when their slug is absent, then inserts the
blocks that mirror exactly what the storefront renders today:

    home    hero_slide (3), trust_badge (4), buyer_card (3), flow_step (4), faq_item (5)
    about   principle (3), flow_step (4), founder (3), location (6), cert (5)
    global  announcement (1), header_nav (4), trending (6), footer_column (3),
            footer_blurb (1), footer_legal (1), pdp_trust_badge (4)

Every ``content`` value is lifted verbatim from the storefront source so the
live look is preserved once the renderer reads from the CMS:

    apps/storefront/components/HeroCarousel.tsx   -> home/hero_slide
    apps/storefront/app/page.tsx                  -> home/{trust_badge,buyer_card,flow_step,faq_item}
    apps/storefront/app/about/page.tsx            -> about/{principle,flow_step,founder,location,cert}
    apps/storefront/components/Shell.tsx          -> global/{announcement,header_nav,trending,footer_column,footer_blurb,footer_legal}
    apps/storefront/components/TrustBadges.tsx    -> global/pdp_trust_badge

``id``/``created_at``/``updated_at`` are supplied explicitly via
``gen_random_uuid()``/``now()`` so the insert does not depend on column
server-defaults (0019 strips several of those). ``sort_order`` follows the
source array index; ``is_active`` is true. ``downgrade()`` deletes the three
pages by slug — blocks cascade via the FK.

Revision ID: 0020_seed_cms_content
Revises: 0019_align_server_defaults
Create Date: 2026-08-02
"""
from __future__ import annotations

import json
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0020_seed_cms_content"
down_revision: str | Sequence[str] | None = "0019_align_server_defaults"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# --- Page definitions --------------------------------------------------------
# {slug: (title, [(kind, content_dict), ...])} — order within each list is the
# sort_order applied per block.

HOME_BLOCKS: list[tuple[str, dict]] = []
# HeroCarousel.tsx SLIDES
HOME_BLOCKS += [
    (
        "hero_slide",
        {
            "eyebrow": "Serviceable pincodes",
            "title": "Everything for your pharmacy, delivered to your door.",
            "body": "Prescription medicines, OTC, devices and cold-chain biologics — one audited supply chain.",
            "cta_label": "Browse products",
            "cta_href": "/products",
            "alt_label": "Track an order",
            "alt_href": "/track",
            "theme": "olive",
        },
    ),
    (
        "hero_slide",
        {
            "eyebrow": "Verified buyers",
            "title": "Wholesale pricing for retailers and clinicians.",
            "body": "Complete KYC once — drug licence or council registration — and your tier pricing applies everywhere.",
            "cta_label": "Register your business",
            "cta_href": "/signup",
            "alt_label": "See categories",
            "alt_href": "/categories",
            "theme": "cream",
        },
    ),
    (
        "hero_slide",
        {
            "eyebrow": "One supplier",
            "title": "Medicines, devices and daily care in one order.",
            "body": "Prescription and OTC, diagnostics, surgical consumables, baby care and cold-chain biologics — every category on one invoice.",
            "cta_label": "Browse all categories",
            "cta_href": "/categories",
            "alt_label": "Shop cold chain",
            "alt_href": "/products?category=cold-chain",
            "theme": "ice",
        },
    ),
]
# page.tsx TRUST
HOME_BLOCKS += [
    ("trust_badge", {"title": "Pan-India delivery", "subtitle": "Across serviceable pincodes", "icon": "M13 3L4 14h6l-1 7 9-11h-6z"}),
    ("trust_badge", {"title": "Cold-chain assured", "subtitle": "GDP-compliant, temperature logged", "icon": "M12 3v18M5 7l14 10M19 7L5 17"}),
    ("trust_badge", {"title": "CDSCO-verified", "subtitle": "Audited sourcing, batch traceable", "icon": "M9 12l2 2 4-5M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7z"}),
    ("trust_badge", {"title": "Role-based pricing", "subtitle": "Wholesale rates for verified buyers", "icon": "M3 17l5-6 4 3 5-7 4 5"}),
]
# page.tsx BUYERS
HOME_BLOCKS += [
    (
        "buyer_card",
        {
            "title": "Retail pharmacies",
            "body": "Drug licence (20B/21B) + GSTIN verified once. Wholesale slabs, credit-friendly COD, batch-level invoices.",
            "href": "/signup",
            "icon": "M4 7h16M6 7v12a2 2 0 002 2h8a2 2 0 002-2V7M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2",
        },
    ),
    (
        "buyer_card",
        {
            "title": "Clinicians & hospitals",
            "body": "Council registration verified. Clinician pricing, Schedule H/H1 handling, cold-chain biologics.",
            "href": "/signup",
            "icon": "M12 3v18M3 12h18",
        },
    ),
    (
        "buyer_card",
        {
            "title": "Home & self care",
            "body": "OTC essentials, devices and wellness delivered without a prescription, at transparent MRP.",
            "href": "/products?category=otc",
            "icon": "M12 21s-7-4.3-9-8.4A5.2 5.2 0 0112 6a5.2 5.2 0 019 6.6c-2 4.1-9 8.4-9 8.4z",
        },
    ),
]
# page.tsx FLOW
HOME_BLOCKS += [
    ("flow_step", {"title": "From licensed makers", "subtitle": "CDSCO-verified, batch recorded on arrival", "icon": "M3 21h18M5 21V9l7-5 7 5v12M9 21v-5h6v5M9 12h.01M15 12h.01"}),
    ("flow_step", {"title": "Stored at 2–8°C", "subtitle": "Cold chain logged at every handover", "icon": "M12 3v18M5 7l14 10M19 7L5 17M12 7l-3-3M12 7l3-3M12 17l-3 3M12 17l3 3"}),
    ("flow_step", {"title": "Verified once", "subtitle": "Drug licence or council registration", "icon": "M9 12l2 2 4-5M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7z"}),
    ("flow_step", {"title": "Tracked delivery", "subtitle": "Followed live to your door", "icon": "M3 16V7h11v9M14 10h4l3 3v3h-7M6.5 19a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6zm11 0a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6z"}),
]
# page.tsx FAQS
HOME_BLOCKS += [
    ("faq_item", {"question": "Who can buy on Nethrasap?", "answer": "Anyone can buy over-the-counter products. Prescription medicines and wholesale pricing require a verified account — retailers upload a drug licence (20B/21B) and GSTIN, clinicians upload their council registration."}),
    ("faq_item", {"question": "How does verification work?", "answer": "Sign up with your phone number, upload your documents from your account page, and our compliance team reviews them. Until then you can browse and order OTC items at standard pricing."}),
    ("faq_item", {"question": "How are Schedule H and H1 medicines handled?", "answer": "They are dispensed only against a valid prescription, which is checked at delivery. Every Schedule drug is labelled on its product page so there are no surprises at the door."}),
    ("faq_item", {"question": "What payment methods are available?", "answer": "Cash or UPI on delivery is available today. Online payment (UPI, card and netbanking) is being enabled and will appear at checkout automatically once live."}),
    ("faq_item", {"question": "How is the cold chain maintained?", "answer": "Cold-chain items move through temperature-controlled storage and transit with logging at each handover, in line with GDP guidelines, so biologics and vaccines arrive within specification."}),
]

ABOUT_BLOCKS: list[tuple[str, dict]] = []
# about/page.tsx PRINCIPLES
ABOUT_BLOCKS += [
    ("principle", {"title": "Verified by default", "body": "Every manufacturer is CDSCO-audited before a single unit enters our warehouse. Buyers verify once — a drug licence or council registration — and it works everywhere on the platform.", "icon": "M9 12l2 2 4-5M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7z", "tone": "olive"}),
    ("principle", {"title": "Priced fairly by role", "body": "Retailers, clinicians and households each see pricing that fits how they buy. Bulk needs get a human quote you can negotiate — nothing is charged until you accept.", "icon": "M3 17l5-6 4 3 5-7 4 5", "tone": "olive"}),
    ("principle", {"title": "Cold chain, never broken", "body": "Biologics and vaccines travel at 2–8°C from the maker's dock to your door, with the temperature logged at every handover. If the chain breaks, the box never ships.", "icon": "M12 3v18M5 7l14 10M19 7L5 17", "tone": "ice"}),
]
# about/page.tsx FLOW
ABOUT_BLOCKS += [
    ("flow_step", {"title": "Sourced from licensed makers", "subtitle": "CDSCO-verified, batch recorded on arrival", "icon": "M3 21h18M5 21V9l7-5 7 5v12M9 21v-5h6v5M9 12h.01M15 12h.01"}),
    ("flow_step", {"title": "QC + batch logging", "subtitle": "Every unit traceable to its manufacturer", "icon": "M9 12l2 2 4-5M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7z"}),
    ("flow_step", {"title": "Stored at 2–8°C", "subtitle": "GDP cold chain, logged at every handover", "icon": "M12 3v18M5 7l14 10M19 7L5 17M12 7l-3-3M12 7l3-3M12 17l-3 3M12 17l3 3"}),
    ("flow_step", {"title": "Delivered to your door", "subtitle": "Pan-India, cash on delivery", "icon": "M3 16V7h11v9M14 10h4l3 3v3h-7M6.5 19a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6zm11 0a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6z"}),
]
# about/page.tsx FOUNDERS
ABOUT_BLOCKS += [
    ("founder", {"name": "Arvind Rajan", "role": "Co-founder · CEO", "line": "Fifteen years in pharma distribution before deciding the paperwork should prove itself. Sets the sourcing bar: no audit, no shelf."}),
    ("founder", {"name": "Meera Krishnan", "role": "Co-founder · Operations", "line": "Built the cold-chain playbook — every 2–8°C handover logged, every exception escalated before the box moves another metre."}),
    ("founder", {"name": "Karthik Subramanian", "role": "Co-founder · Technology", "line": "Wrote the first batch-traceability system on a warehouse floor. Believes software should disappear behind a clean invoice."}),
]
# about/page.tsx LOCATIONS
ABOUT_BLOCKS += [
    ("location", {"city": "Chennai", "role": "Headquarters · cold-chain hub", "note": "Primary warehouse, QC and batch intake"}),
    ("location", {"city": "Coimbatore", "role": "Fulfilment centre", "note": "Western Tamil Nadu, next-day lanes"}),
    ("location", {"city": "Bengaluru", "role": "Cold-chain hub", "note": "Biologics and vaccine distribution"}),
    ("location", {"city": "Hyderabad", "role": "Fulfilment centre", "note": "Telangana and Andhra coverage"}),
    ("location", {"city": "Mumbai", "role": "Fulfilment centre", "note": "Western region wholesale lanes"}),
    ("location", {"city": "Delhi NCR", "role": "Fulfilment centre", "note": "Northern region coverage"}),
]
# about/page.tsx CERTS
ABOUT_BLOCKS += [
    ("cert", {"label": "CDSCO-verified sourcing"}),
    ("cert", {"label": "GDP-compliant cold chain"}),
    ("cert", {"label": "Drug licence 20B / 21B"}),
    ("cert", {"label": "GST registered"}),
    ("cert", {"label": "Batch-level traceability"}),
]

GLOBAL_BLOCKS: list[tuple[str, dict]] = []
# Shell.tsx Announce
GLOBAL_BLOCKS += [
    ("announcement", {"lead": "Pan-India delivery", "text": "across serviceable pincodes · GDP-compliant cold chain · CDSCO-verified sourcing"}),
]
# Shell.tsx HEADER_NAV
GLOBAL_BLOCKS += [
    ("header_nav", {"label": "Products", "href": "/products"}),
    ("header_nav", {"label": "Categories", "href": "/categories"}),
    ("header_nav", {"label": "Track", "href": "/track"}),
    ("header_nav", {"label": "About", "href": "/about"}),
]
# Shell.tsx TRENDING
GLOBAL_BLOCKS += [
    ("trending", {"label": "Amoxicillin"}),
    ("trending", {"label": "Insulin"}),
    ("trending", {"label": "BP monitor"}),
    ("trending", {"label": "Thermometer"}),
    ("trending", {"label": "Vitamin D3"}),
    ("trending", {"label": "Surgical gloves"}),
]
# Shell.tsx footer columns
GLOBAL_BLOCKS += [
    (
        "footer_column",
        {
            "heading": "Shop",
            "links": [
                {"label": "All products", "href": "/products"},
                {"label": "Categories", "href": "/categories"},
                {"label": "Compare", "href": "/compare"},
                {"label": "Track order", "href": "/track"},
                {"label": "About us", "href": "/about"},
            ],
        },
    ),
    (
        "footer_column",
        {
            "heading": "Account",
            "links": [
                {"label": "Sign in", "href": "/login"},
                {"label": "Register as retailer / clinician", "href": "/signup"},
                {"label": "My orders", "href": "/account"},
                {"label": "Saved items", "href": "/wishlist"},
            ],
        },
    ),
    (
        "footer_column",
        {
            "heading": "Buying for",
            "links": [
                {"label": "Retail pharmacies", "href": None},
                {"label": "Clinicians & hospitals", "href": None},
                {"label": "Home care", "href": None},
            ],
        },
    ),
]
# Shell.tsx footer blurb + legal
GLOBAL_BLOCKS += [
    ("footer_blurb", {"text": "India's audited healthcare supply platform. GDP-compliant cold chain, CDSCO-verified sourcing."}),
    ("footer_legal", {"text": "© 2026 Nethrasap. For authorised buyers only. Not a substitute for professional medical advice."}),
]
# TrustBadges.tsx (PDP) — each badge carries multiple SVG path `d` strings.
GLOBAL_BLOCKS += [
    ("pdp_trust_badge", {"label": "CDSCO-verified", "paths": ["M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z", "M9 12l2 2 4-4"]}),
    ("pdp_trust_badge", {"label": "GDP cold chain", "paths": ["M12 2v20M4 6l16 12M20 6L4 18", "M12 2l-2 3h4zM12 22l-2-3h4z"]}),
    ("pdp_trust_badge", {"label": "GMP facility", "paths": ["M3 21V10l6 3V10l6 3V10l6 3v8z", "M3 21h18", "M7 21v-4h3v4M14 21v-4h3v4"]}),
    ("pdp_trust_badge", {"label": "Easy returns", "paths": ["M9 14L4 9l5-5", "M4 9h11a5 5 0 0 1 0 10h-4"]}),
]

PAGES: list[tuple[str, str, list[tuple[str, dict]]]] = [
    ("home", "Home", HOME_BLOCKS),
    ("about", "About us", ABOUT_BLOCKS),
    ("global", "Global storefront chrome", GLOBAL_BLOCKS),
]


_INSERT_PAGE = sa.text(
    """
    INSERT INTO cms_pages (id, slug, title, is_published, created_at, updated_at)
    VALUES (gen_random_uuid(), :slug, :title, true, now(), now())
    RETURNING id
    """
)

_INSERT_BLOCK = sa.text(
    """
    INSERT INTO cms_blocks (id, page_id, kind, sort_order, is_active, content, created_at, updated_at)
    VALUES (gen_random_uuid(), :page_id, :kind, :sort_order, true, CAST(:content AS jsonb), now(), now())
    """
)


def upgrade() -> None:
    bind = op.get_bind()
    for slug, title, blocks in PAGES:
        exists = bind.execute(
            sa.text("SELECT id FROM cms_pages WHERE slug = :slug"), {"slug": slug}
        ).first()
        if exists is not None:
            # Idempotent: leave any hand-edited page untouched.
            continue
        page_id = bind.execute(_INSERT_PAGE, {"slug": slug, "title": title}).scalar_one()
        for sort_order, (kind, content) in enumerate(blocks):
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
    # Blocks cascade via the cms_blocks.page_id FK (ondelete=CASCADE).
    bind.execute(
        sa.text("DELETE FROM cms_pages WHERE slug IN ('home', 'about', 'global')")
    )
