# Storefront CMS — Build Plan

**Date:** 2026-08-02
**Goal (owner):** every storefront marketing surface — hero slides, trust/feature cards, FAQ,
promo/announcement strip, About content, footer, nav, section headings — editable from the
dashboard by **admin AND manager**, who can create/edit/delete each item. Everything currently
hardcoded becomes DB-backed and rendered from the API.

## Headline

- The CMS **backend already exists and is fully reusable** — `cms_pages` / `cms_blocks` /
  `app_settings` / `feature_flags` (migration 0006), `services/cms.py`, `api/v1/cms.py`
  (public read + admin CRUD, audit-logged, realtime events), router already registered.
- The storefront **consumes none of it today** — every marketing string is a hardcoded in-file
  array. This build makes the storefront read the CMS, and seeds the current copy so nothing
  changes visually at launch.
- `manager` did not hold `cms:write` — now granted, so admin + manager can both edit.
- **No new tables** — only a data-seed migration (`0020`).

## Content model (typed blocks over existing tables)

Three surfaces = three `cms_pages`: `home`, `about`, `global`. Each `cms_blocks.content` is JSON
shaped per `kind`; `sort_order` = display order; `is_active` = publish/unpublish per item.

- **home:** hero_slide · trust_badge · buyer_card · flow_step · faq_item · section_heading ·
  section_intro · cta_band
- **about:** about_hero · stat · story_para · principle · flow_step · founder · location · cert · cta_band
- **global:** announcement · header_nav · trending · footer_blurb · footer_column · footer_legal ·
  pdp_trust_badge · site_meta

(Full field lists in the build-agent prompts / the analysis transcript.)

## Workstreams (parallel, disjoint files)

- **Backend** — grant manager `cms:write` (`rbac_data.py`); add `POST /admin/cms/uploads`
  (R2 presign) to `api/v1/cms.py`; migration `0020` seeds all three pages + blocks copied
  **verbatim** from the current arrays (SVG path `d` strings included) so the look is byte-preserved;
  extend `test_cms.py`.
- **Storefront** — `lib/content.ts` (`getPage(slug)` with `revalidate:300` + `tags:["cms:<slug>"]`
  and in-code DEFAULTS as fallback); `AnnouncementBar.tsx` + `DynamicFooter.tsx`; an
  `app/api/revalidate/route.ts` on-demand webhook; `page.tsx` / `about/page.tsx` /
  `HeroCarousel.tsx` / `TrustBadges.tsx` read blocks with fallback. Every section degrades to
  DEFAULTS if a block is missing — the page can never blank.
- **Dashboard** — a "Storefront Content" section (admin + manager): list surfaces, per-surface
  block editor (create/edit/delete/reorder/publish, per-kind forms), R2 image upload, and a
  storefront revalidate call on save. Preview link per surface.

## Shared files (integrator-merged, not touched by agents)

- `apps/storefront/components/Shell.tsx` — swap `<Announce/>`→`<AnnouncementBar/>`,
  `<Footer/>`→`<DynamicFooter/>`.
- `apps/dashboard/components/Shell.tsx` — add one nav item `{href:"/content", label:"Content",
  perm:"cms:write"}` (shows for admin + manager automatically).
- `api/v1/router.py` — **no change needed** (cms already registered).

## Migration + seed

`0020_seed_cms_content` (down_revision `0019_align_server_defaults`): data-only, idempotent
(guard on slug), reversible (delete pages by slug → blocks cascade). Belt-and-suspenders: the
storefront also ships the same copy as in-code DEFAULTS, so the look survives even before the
seed runs.

## Risks

SSR staleness (mitigated by `revalidateTag` webhook on save + 300s TTL fallback); backend
accepts arbitrary block JSON (dashboard forms enforce shapes, storefront defaults every field);
granting manager `cms:write` bumps the role permission version → managers re-login once. Public
content is unauthenticated, so no SSR-auth issue.
