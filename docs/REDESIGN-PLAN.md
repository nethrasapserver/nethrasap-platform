# Nethrasap UI Redesign — Quick-Commerce Enterprise Plan

*Prepared 2026-07-19. **Approved and implemented 2026-07-20** (all phases UI-0…UI-5
in one pass — see §9 Implementation log). D1/D3/D4 approved as recommended.*

## 1. Direction

Merge three inputs into one system:

1. **The extracted design system from `../backups`** (both reference repos share one
   hand-written token stylesheet): olive brand ramp `--brand-50…900`
   (`#606c38` Olive Leaf → `#283618` Black Forest), warm accents (cream `#fefae0`,
   clay `#dda15e`, copper `#bc6c25`), Geist + Geist Mono + Fraunces, olive-tinted
   shadows, radius scale 6–28px, a mature component inventory (pills, dtable,
   KPI/bento cards, drawers, modals, toasts, skeletons, empty states, icon factory).
2. **Blinkit/Instamart interaction model**: dense catalogue grids, stepper-on-card
   add-to-cart, floating "view cart" bar, horizontal snap rails, sticky PDP buy bar,
   app-like floating bottom nav, instant search overlay, delivery/Rx badges.
3. **Enterprise dashboard patterns** from the mock: brand-900 sidebar with clay
   active-accent, ⌘K topbar, KPI + bento analytics grid, mono-for-data typography,
   status-pill taxonomy, dense sticky-header tables.

The identity stays **Nethrasap olive** — trust and audit-grade credibility matter in
healthcare supply; we take Blinkit's *ergonomics*, not its neon.

## 2. Token reconciliation (the two backup repos diverged — decisions)

| # | Conflict | Decision (recommended) |
|---|---|---|
| 1 | Ink: neutral near-black (storefront repo) vs olive-tinted (dashboard repo) | **Neutral ink with a whisper of olive** (`#101208` / `#3c3f36` / `#70746a`); olive reserved for brand surfaces & actions — the "de-greened" direction is the newer, more polished one |
| 2 | Success color: `#0a0a0a` (!) vs `#4f6b2a` vs `#16a34a` — three greens | **One success green `#4f6b2a`** + tint `#ecefda`; never black |
| 3 | Body background: `#fff` vs `#f5f5f5` | Storefront `#fbfbf7` (warm paper), dashboard `#f4f4f1` |
| 4 | Chart palette: off-brand blue-indigo (`#2563eb…`) | **Brand-anchored data-viz set**: olive `#606c38`, clay `#dda15e`, copper `#bc6c25`, info blue `#2b5b73`, rose `#b94824`, slate track |
| 5 | Radius: tokens defined but hardcoded 10/14/18px scattered | Enforce `--radius-sm 8 / md 12 / lg 16 / xl 24 / pill 999`; delete magic numbers |
| 6 | No spacing scale anywhere | Introduce `--space-1…12` on a 4px base |
| 7 | Fonts via Google CDN | **Self-hosted via `next/font`** (Geist, Geist Mono, Fraunces) — no external font requests, better LCP, CSP-clean |
| 8 | Focus rings only in storefront repo copy | Global `:focus-visible` ring token, both apps |

Typography (**decided 2026-07-20, revised same day**): **Plus Jakarta Sans is the
only typeface** — the open-source equivalent of Instamart's Gilroy (which is
commercial and cannot be shipped unlicensed). Headings 700–800 with tight tracking;
data elements (prices, KPI numbers, order ids, table headers) keep their distinct
*treatments* — uppercase, wide tracking, `tabular-nums` — but render in the same
family (owner decision: secondary must match primary). The `--font-mono-stack`
token now points at the sans family; a dedicated data face can be reinstated later
by repointing that one token (GeistMono.woff2 stays in `packages/ui/fonts`).
Fraunces is dropped. Self-hosted via `next/font/local`.

## 3. Architecture

- **New `packages/ui`** consumed by both apps (also resolves the W1 duplication debt):
  - `tokens.css` — the single `:root` token layer (+ dark-theme block, reduced-motion).
  - `base.css` — reset, typography, focus, scrollbars.
  - `components/` — React primitives: `Button`, `Pill`, `Input/Field`, `Card`, `Modal`,
    `Drawer`, `Toast`, `Skeleton`, `EmptyState`, `Stepper`, `StarRating`, `Tabs`,
    `DataTable`, `KpiCard`, `StatusPill`, `Icon` (the inline-SVG factory from the
    backups — no icon library dependency).
- **No Tailwind, no UI library** — the reference system is token-driven global CSS;
  we keep that (zero new runtime deps, matches existing codebase idiom).
- Business logic untouched: pages keep their data hooks; only presentation changes.

## 4. Quick-commerce patterns to build (storefront)

| Pattern | Detail |
|---|---|
| Card stepper | ATC button morphs into `− 2 +` stepper wired to the cart context (optimistic, debounced PATCH) — the core Blinkit control, missing from every reference |
| Floating cart bar | `2 items · ₹1,230 · View cart →` — fixed above bottom nav on mobile, bottom-right pill on desktop; slides in when count > 0 |
| Category rails | Horizontal scroll-snap rails (home + PLP chip row); grids stay dense: 6-up desktop / 3-up tablet / 2-up mobile |
| Sticky PDP buy bar | Mobile-fixed price + variant + stepper bar; desktop keeps sticky price card |
| Search overlay | Header search pill + ⌘K overlay with recent/trending chips, category quick-grid |
| Bottom nav | Floating pill nav (safe-area aware): Home / Browse / Saved / Cart / Account with badges |
| Card badges | Delivery-time pill, Rx schedule pill, discount badge, out-of-stock scrim, wishlist heart, compare toggle |
| Feedback | Skeleton shimmer on all loads, empty states with actions, `img-soft-in`, add-to-cart toast + cart-badge pop |

## 5. Screen inventory

**Storefront (all restyled + upgraded):** home (hero strip → category rail → featured
rails → trust/compliance strip → footer), products PLP (filter rail, sort, grid/list
toggle), PDP (gallery + thumbs, price card, variant chips, trust row, tabs:
description/specs/reviews-placeholder), cart, checkout (stepper header, address,
payment methods from API), orders list + detail (timeline), account, login + signup
(split auth shell, brand-900 side panel, OTP cells), wishlist, compare, 404/empty.

**Dashboard (all restyled):** portal shell (brand-900 sidebar, clay active bar,
collapse mode, ⌘K topbar, mobile drawer), home (**colorful KPI row** — one dark
brand-900 hero tile + tinted metric tiles (clay/info/copper grounds, colored icon
chips, sparklines with area fill + endpoint dot; values/labels stay in ink tokens,
never in the accent color) + bento analytics), orders
list/detail (dispatch/refund modals), verifications queue + review panel, catalogue,
inventory, enquiries, chat inbox (two-pane), team, audit, HR employees/leave/payroll,
login (split shell). Every table → `DataTable` (mono sticky header, hover rows,
status pills); charts on the brand data-viz palette.

## 6. Phases (each ends: docker rebuild + browser review at 375/768/1280 + a11y pass)

| Phase | Scope | Exit criteria |
|---|---|---|
| **UI-0 Foundation** | `packages/ui` tokens/base/fonts/icons/primitives; both apps import the layer | Apps render unbroken on new tokens |
| **UI-1 Storefront shell** | Header + search overlay, bottom nav, floating cart bar, footer, page scaffolds | Shell approved on mobile + desktop |
| **UI-2 Catalogue** | Product card w/ stepper, rails, PLP, PDP + sticky buy bar | Add-to-cart flow feels Blinkit-grade |
| **UI-3 Purchase & account** | Cart, checkout, orders, account, auth, wishlist, compare | Full purchase journey restyled |
| **UI-4 Dashboard shell** | Sidebar/topbar, DataTable, StatusPill, KPI/bento home | Staff shell + home approved |
| **UI-5 Dashboard modules** | All remaining portal pages, charts, modals, HR | Zero legacy-styled screens left |

## 7. Verification & quality gates

- Browser screenshot review per phase (375 / 768 / 1280) before moving on.
- WCAG AA contrast (olive `--brand-700` for text-on-light; `--brand-600` only ≥18px).
- `:focus-visible` rings, `prefers-reduced-motion`, `@media (hover:hover)` gating,
  `env(safe-area-inset-bottom)` on fixed bars.
- `npm run typecheck && npm run build` green per phase; no API/backend changes.
- Chart palettes (UI-5) must pass the dataviz palette validator (CVD separation,
  lightness band, contrast) on both light and dark surfaces before shipping.

## 8. Open decisions for the owner

All resolved 2026-07-20: D1 token reconciliation approved; D2 Plus Jakarta Sans
everywhere (Fraunces dropped); D3 olive stays primary; D4 phase order as planned.

## 9. Implementation log (2026-07-20)

- **`packages/ui`** — new workspace package: `styles.css` (tokens + base + shared
  component classes), `portal.css` (dashboard layer), self-hosted variable fonts
  (`fonts/PlusJakartaSans.woff2` 27KB, `fonts/GeistMono.woff2` 23KB) loaded via
  `next/font/local` in both apps — zero font/CDN requests at runtime or build time.
- **Class-vocabulary compatibility strategy**: the design system redefines the class
  names the pages already use (`.btn .card .pill .table/.tbl .input .kpi …`), so all
  ~24 screens inherited the restyle; only shells and key screens were rewritten.
- **Storefront**: announcement bar; header with search pill + ⌘K overlay (trending
  chips); floating pill bottom nav (safe-area aware, badges); floating cart bar;
  brand-900 footer; **stepper-on-card** add-to-cart (new additive backend field
  `default_variant_id` on `ProductListItem`); category snap-rail + featured grid +
  trust strip on home; sticky mobile buy bar on PDP; responsive `.two-col` layouts
  for cart/checkout/PDP/order pages; **new `/track` page** (kills the dead nav link,
  uses the existing public track endpoint).
- **Dashboard**: brand-900 sidebar with clay active-accent, icons, mobile drawer +
  scrim; sticky topbar with breadcrumb + role pill; **colorful KPI row** (dark hero
  revenue tile with live sparkline, clay/info/copper tinted tiles) fed by the real
  analytics endpoints; brand-gradient revenue bars; top-products bar rows; split
  auth shell login (hardcoded demo-credentials hint removed — closes the CI-grep
  gap flagged in discovery).
- Cart context gained `qtyForVariant` / `incVariant` / `decVariant` for the card
  steppers (server-authoritative, no local drift).
- **Auth kit promoted into `packages/ui`** (2026-07-21): `packages/ui` now ships
  React as well as CSS — `fields.tsx` (PhoneField with fixed +91 affix, 6-cell
  OtpInput with auto-advance/paste, PasswordField with reveal, `useResendTimer`)
  and `auth.css` (page ground, capsule background, card, segmented control,
  role picker). Both apps add `transpilePackages: ["@nethrasap/ui"]`.
  The **ops dashboard login** was rebuilt on the same kit — identical field
  quality, inline errors and a new OTP option for staff — rather than copying
  components across apps. Note the import order in the dashboard: `auth.css`
  comes *after* `globals.css` so `.btn-lg` (48px) beats the dense portal
  `.btn` (38px). The old `.auth-shell` split styles were deleted from portal.css.
  Deliberately **no Google button on the staff console** — those accounts are
  provisioned internally and permission-gated, so an external IdP has no role.
- **Auth pages rebuilt as a route group** (owner brief 2026-07-21): `/login` and
  `/signup` moved into `app/(auth)/` sharing one layout — URLs unchanged. Desktop
  is a **40 / 60 split**: form left, product showcase right. The showcase pulls
  **real featured products** from the API (image, name, price) rather than stock
  art, degrading to a card-free panel if the fetch fails so auth never breaks on
  an API hiccup. Login gained a segmented password/OTP control and resend; signup
  gained a 3-step progress rail and a role picker with plain-language hints.
  Page furniture (footer, bottom nav, cart bar) is suppressed via `body:has()`
  so auth stays a focused task. Collapses to single column ≤1000px.
- ⚠️ **Google sign-in is UI-only and cannot function as built.** The button is
  present per the brief, but Nethrasap is phone-first — migration 0004 dropped
  the email column, so a Google identity has no field to land in and no verified
  phone. Clicking it explains this rather than failing silently. Making it real
  needs an owner decision (it reverses part of the phone-first rule) plus: an
  `email`/`google_sub` column + migration, a `POST /auth/google` endpoint doing
  server-side ID-token verification, an account-linking rule for existing phone
  users, and a phone-capture step (KYC and delivery both depend on a phone).
- **Surfaces re-toned to white-page / warm-components** (owner brief 2026-07-21):
  the page ground is now pure white (`--paper: #ffffff`); the previous warm
  off-white (`#fbfbf7`) became the SECONDARY surface (`--card`) used by cards,
  panels and component grounds, so components read as gently raised on white.
  A new `--field: #ffffff` keeps inputs and interactive chrome (search pill,
  icon buttons, outline buttons, product-card action circles, add-to-cart)
  crisp white on the warm cards. Both apps: dashboard `body` now follows
  `--paper` too, so its colorful KPI tiles pop on white. Single-token change at
  source — one swap propagated everywhere.
- **Two-hue system adopted across both apps** (owner brief 2026-07-21 — "don't
  just use green, mix the ice blue in, and don't let it look AI generated").
  Added an `--ice-50…900` ramp and, critically, **a rule for when each hue is
  used** — sprinkling a second colour without a rule is precisely what reads as
  arbitrary:
  > **Olive = brand & action** — buttons, add-to-cart, prices, active nav, the
  > flow nodes. **Ice = information & assurance** — surfaces you *read* rather
  > than click.
  Applied to: trust-strip icon chips, table headers (both apps), compare's sticky
  attribute column, cart/checkout summary panels (`.summary-card`), order + track
  milestone rails (`.track-step`, previously hardcoded olive inline), checkout
  step numbers, empty-state icons, dashboard panel heads and drawer headers, and
  the About section ground — where an ice ground carries olive nodes so the two
  hues meet in one composition instead of living on separate pages.
  `--info` now points at the ice ramp so the system has one teal, not two
  near-identical ones.
- **Third hero slide replaced** (owner brief 2026-07-21): the dark Black Forest
  cold-chain banner is gone. New slide covers catalogue breadth ("Medicines,
  devices and daily care in one order") on an **ice palette lifted from the Cold
  Chain category tile** (`#dceaf0 → #edf5f8`, accent `#2b6b7f`) so hero and
  catalogue share one colour language. All three slides are now light grounds,
  which also let the dark closing CTA stay the page's single dark moment.
  `.is-forest` theme deleted.
- **Featured shelf changed to 5 across / 10 total** (owner brief 2026-07-21) —
  `SHELF_SIZE` dropped from 12 to 10 so the grid stays two *complete* rows
  instead of 5+5+2. Responsive: 5 → 4 → 3 → 2.
- **Closing CTA rebuilt as a dark verification panel**: the ask is "get verified",
  so the panel now names the exact document each buyer type needs — retail
  pharmacy (drug licence 20B/21B + GSTIN), clinician (council registration),
  hospital (institutional licence) — mirroring the KYC doc types the backend
  accepts. Full brand-900 ground with a clay glow (the only dark block after a
  long light scroll, so the final ask carries weight); cream primary button since
  olive-on-dark would disappear, plus a secondary browse action.
- **FAQ centred and narrowed** to a 680px column with a centred header block
  (eyebrow + title + one line); accordion restyled with a circular +/− control
  that inverts to solid brand when open, brand-tinted open border, hover state
  and a short fade on reveal. Still native `<details>` — no JS, keyboard and
  screen-reader friendly by default.
- **Cascade bug fixed (affected 4 home sections)**: `.section { padding: X 0 }`
  was declared after `.container { padding: 0 20px }` at equal specificity, so
  the shorthand zeroed horizontal padding on every `section.section.container` —
  content ran to the screen edge on mobile. Changed to `padding-block`, restoring
  the 20px gutters site-wide.
- **About section rewritten as a supply-chain sequence** (owner brief 2026-07-20 —
  "don't make it look AI generated"): the previous version used the templated
  "X, not Y" headline over four uniform feature cards. Replaced with the concrete
  journey a box takes — manufacturer → 2–8°C storage → buyer verification →
  doorstep — as a numbered chain joined by a hairline (numbering is legitimate
  here because it *is* a sequence; on mobile the line rotates to a vertical
  timeline). Copy is specific rather than generic: real brands from the catalogue,
  the actual licence types (20B/21B, GSTIN, council registration), the real
  temperature band and Schedule H/H1 handover rule. The figures row uses **live
  catalogue counts**, never invented statistics — no fabricated "customers served".
  Presentation follows the owner's reference: four large circular icon nodes on a
  dotted connector, labels **alternating above/below** so the eye zig-zags along
  the journey, trimmed to a short title + one supporting line. Responsive:
  4-across → 2-up (connector dropped) → single column with circle-left/label-right
  and a vertical dotted rail. *Gotcha for future edits:* `.is-up`/`.is-down` carry a
  class each, so breakpoint overrides must match that specificity — a plain
  `.flow li .flow-cap` reset loses to them and drops labels out of alignment.
- **Product imagery surfaced platform-wide** (owner brief 2026-07-20): the seed
  already stored a primary image per product, but `ProductListItem` never exposed
  it — so every card rendered a generic glyph. Added `image_key` to the card
  serializer (with `selectinload(Product.images)` on the list + saved-items
  queries) and regenerated types. Product cards, wishlist and compare now show
  the real photo, falling back to the branded tile when a product has none.
- **Compare page rebuilt as a proper comparison table**: product columns lead
  with an image, name, price and an inline ADD/stepper (compare should end in a
  purchase); the **attribute column is sticky** so labels stay readable while
  columns scroll; horizontal scroll with left/right arrows that appear only when
  the table overflows and disable at each end. Verified at 760px: 4 columns
  scroll under a pinned label column with all images loading.
- **Header restructured into three zones** (owner brief 2026-07-20): *identity*
  (logo) · *find* (search pill, ⌘K) · *browse* (Products / Categories / Track as
  text) · *act* (icon cluster: Saved ♥ with count badge, Cart with count badge,
  then the profile menu). Text labels for Saved and Sign out are gone from the
  top bar. **Sign out now lives inside the profile dropdown**, last and behind a
  divider in danger colour so it can't be mis-clicked; the menu also carries
  Account & orders, Saved items, Compare and Track, each with live counts.
  Dropdown closes on outside-click and Escape, uses `aria-haspopup`/`aria-expanded`
  and `role="menu"`. Below 760px the browse links drop to the bottom nav and the
  search pill collapses to an icon — verified no horizontal overflow at 390px.
- **Home page rebuilt as a merchandising page** (owner brief 2026-07-20):
  auto-advancing **hero carousel** (3 banner slides, arrows + dots, swipe, pauses
  on hover/focus, no auto-advance under `prefers-reduced-motion`); **category rail**
  with per-category art tiles — 6 visible, remainder scrolls via left/right arrows
  that disable at each end (renders `image_key` when an admin uploads one, themed
  gradient + icon until then); **Featured Products** shelf of exactly 12 in two
  rows of six (featured first, topped up with popular so the grid never renders a
  ragged half-row); plus new **buyer-segment**, **About us**, **FAQ**
  (native `<details>`) and closing **CTA** sections.
  Dev seed extended to 8 categories / 20 products so the layout is demonstrable.
- **Overlays are drawers, not modals** (owner decision 2026-07-20): a single
  `components/Drawer.tsx` right-side task panel replaced the centred `Modal`
  across all six dashboard popups (new product, quote enquiry, receive stock,
  add employee, dispatch order, refund order). The record being acted on stays
  visible; sticky header + footer keep the primary action reachable. Adds what
  the old modal lacked: `role="dialog"`/`aria-modal`, Escape-to-close, Tab focus
  trap, focus restore on close, body scroll lock, and full-width sheet ≤560px.
  `wide` variant for multi-line forms. `Modal.tsx` deleted.
- **Money is entered in rupees, never paise** (fixes a discovery-flagged defect
  visible in the HR form): `toPaise()` / `toRupeeInput()` helpers in
  `lib/format.ts` convert at the form boundary. Employee salary, enquiry quote
  lines and order refunds now read "₹ / month", "Unit price (₹)", "Amount (₹)"
  with live totals; the refund panel also guards against exceeding the amount paid.
- **Staff-on-storefront banner** (owner decision, option 2): staff signing in on
  the storefront is *allowed* (they order on a customer's behalf and the pricing
  service already grants them retailer-tier rates), but a clay banner now states
  the role + pricing tier and links to the ops portal — removing the "why am I on
  a customer account page?" confusion. Portal URL is configurable via
  `NEXT_PUBLIC_DASHBOARD_URL` (compose build arg; defaults to `http://localhost:3001`).
  Verified: renders for sales/manager/admin, absent for customer/clinician/retailer.
