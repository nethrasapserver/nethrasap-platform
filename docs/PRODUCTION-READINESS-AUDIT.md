# Production Readiness Audit — Nethrasap Platform

**Date:** 2026-08-01
**Verdict:** 🔴 **NO-GO — not production-ready**
**Method:** Nine specialist tracks (auth, authorization, storefront, dashboard, commerce
workflows, security surface, offensive testing, code quality, operations). Every finding was
**verified by executing against the live system** — live API calls, real browser interaction,
and database verification — not by reading code.

**Tally:** 6 critical · 22 high · 31 medium · 40+ low · 30+ controls verified solid.

> This file is the tracking source of truth. Update the **Status** column as fixes land.
> Companion visual report: published artifact (production-readiness dashboard).

---

## The through-line

The architecture is genuinely strong. Failures cluster into three fixable themes, none architectural:

1. **TOCTOU (time-of-check/time-of-use) on every unlocked write** — refunds, coupon redemption,
   and webhook capture are the same race three times, written by someone who locked `inventory.py`
   correctly. Fix shape is identical: `SELECT … FOR UPDATE` + a DB constraint.
2. **Incomplete last-mile wiring** — RFQ orders skip inventory/payment/invoice; an un-awaited
   refund; search that can't match partial words; role pricing wrong on listings.
3. **A deploy blueprint that boots to a crash as committed.**

---

## Track scorecard

| Track | Rating | Headline |
|---|---|---|
| Authentication & authorization | SOLID | 143 route×role combos; no anon reached any staff route; all forgery rejected. One PII-scoping gap. |
| Commerce workflows | FAIL | 2 critical money/stock defects; TOCTOU on refunds/coupons/webhooks; RFQ skips inventory/payment/invoice. |
| Storefront (UX) | FAIL | Search unusable; role pricing wrong on listings; live test data; unmoderated review. |
| Dashboard (UX/CRUD) | PARTIAL | Core KPIs reconcile; one analytics page crashed; can't add 2nd pack size; 403 renders as zero-data. |
| Security surface | PARTIAL | Nested-JSON DoS on every POST; docs exposed; upload cap cosmetic. SQLi/mass-assign/CORS held. |
| Offensive testing | PARTIAL | One exploitable HIGH: unauthenticated order-book enumeration. RBAC/IDOR/price integrity held. |
| Code quality | PARTIAL | 201 tests pass but on `create_all`, hiding migration drift; un-awaited refund; dead duplicate logic. |
| Production / ops | FAIL | render.yaml boots to a crash; frontends run as root; no error tracking; no verified backups. |
| Runtime health (now) | PASS | All services healthy; no log errors; worker sweeping outbox cleanly. |

---

## CRITICAL — launch blockers

| ID | Finding | Evidence | Location | Status |
|---|---|---|---|---|
| **CR-1** | **Concurrent refunds over-refund real money.** 5 parallel refunds on a ₹145.20 payment issued ₹726 (₹580 excess), each a real gateway call. No row lock, no `sum(refunds) ≤ amount` constraint; gateway call precedes commit. | `payment_amount 14520 / refund_rows 5 / total_refunded 72600` | `services/fulfilment.py:216-224` | ☐ Open |
| **CR-2** | **RFQ conversion bypasses all inventory.** Sold + dispatched 500 units from a 6-unit warehouse; erased another order's reservation; phantom dispatch from `on_hand=0`; 494 units ledger drift. | cart order for 3 → 409; RFQ for 500 → convert → dispatch → 200 | `enquiries.convert` (no reserve); `inventory.py:287-289` | ☐ Open |
| **CR-3** | **Committed deploy blueprint boots to a crash.** `ENVIRONMENT=production` + `SMS_PROVIDER=console` hits the config guard → hard boot fail; `STORAGE_*` unset does the same; `.onrender.com` base breaks guest carts/refresh; `NEXT_PUBLIC_DASHBOARD_URL` unset → localhost link. | `config.py:91-97` raises ValueError on that combo | `render.yaml:19,34-35,128-129` | ☐ Open |
| **CR-4** | **Product search effectively unusable.** Whole-word only; no prefix/fuzzy; multi-word → 0. | `amox→0, para→0, "blood pressure"→0, "amoxicillin 500"→0` | storefront `/products` + ⌘K; backend `plainto_tsquery` | ☐ Open |
| **CR-5** | **Role pricing wrong on listings — price shown ≠ charged.** Verified retailer browses retail prices on cards but is charged wholesale. | listing ₹2,116.80 vs PDP/cart ₹1,848 | listing serializer resolves customer tier regardless of role | ☐ Open |
| **CR-6** | **Analytics "Sales team" page crashes on every load.** Page expected `Rep[]`, API returns `{team: Rep[]}`; `.reduce` on an object throws. | `TypeError: m.reduce is not a function` | `dashboard app/(portal)/analytics/sales/page.tsx` | ✅ **Fixed 2026-08-01** |

---

## HIGH

| ID | Finding | Location | Status |
|---|---|---|---|
| **H-1** | Unauthenticated order-book enumeration — omit `phone_last4` → any order's data; sequential numbers → whole book scrapeable; no rate limit. | `services/orders.py:316-345` (fail-open `else: pass`) | ☐ Open |
| **H-2** | Nested-JSON DoS crashes every POST (RecursionError → 500), unauth; no request-body size cap. | `main.py:107` | ☐ Open |
| **H-3** | Un-awaited `razorpay.refund()` in the order service — coroutine indexed; breaks paid-order cancellation when online payment is enabled. | `services/orders.py:235` | ☐ Open |
| **H-4** | Migrations diverge from models, invisibly — tests use `create_all`; `alembic check` fails (33 server-default + 5 structural). **Related (found 2026-08-01):** (a) `alembic downgrade base` is broken — a downgrade re-adds NOT-NULL `order_items.brand_snapshot` over existing nulls; (b) `scripts/reset_db.py` calls Alembic from inside an asyncio loop → `RuntimeError`, so it never runs. | `tests/conftest.py:134-135`; downgrade chain; `scripts/reset_db.py:30-37` | ☐ Open |
| **H-5** | No COD order can ever be refunded, and no record COD cash was collected (`captured_at` stays NULL forever). | fulfilment refund requires `captured`; delivery never captures COD | ☐ Open |
| **H-6** | New variants are untracked and sell without limit — the default state of every admin-created variant (900 units / ₹90k ordered). | tracked-vs-untracked policy | ☐ Open |
| **H-7** | Coupon `max_uses` unenforceable under concurrency; `used_count` is a lossy Python read-modify-write. | `checkout.py:342` | ☐ Open |
| **H-8** | Guest cart destroyed on login — merge re-points items then cascade-deletes them. | `services/cart.py:120-125` + `models/cart.py:61` | ☐ Open |
| **H-9** | GST charged on the pre-discount value (over-collects output tax, contra s.15(3) CGST); invoice has no GSTIN / CGST-SGST-IGST split. | `pricing.py`; `seller_gstin` defaults `""` | ☐ Open |
| **H-10** | Top-products revenue double-counts GST (~+10.7%); the one dashboard number that fails "traceable to a DB row". | `analytics/top-products` returns `line_total + gst_amount` | ☐ Open |
| ~~H-11~~ | Sales reps see every order incl. customer PII + company-wide financials. **Owner decision 2026-08-01: intended** — shared ops queue; customer name/phone is inherent to fulfilment. | `admin_orders.py` | ✅ **By design — closed** |
| **H-12** | Dashboard can't add a 2nd pack size — the "…" menu opens the drawer over itself; clicks fire no request. | `dashboard products/page.tsx` z-order | ☐ Open |
| **H-13** | A 403 renders as legitimate zero-data — manager sees an empty warehouse (0/0/0) against 22 SKUs / 4,791 units. | inventory read gated on `inventory:write`; 403 not surfaced | ☐ Open |
| **H-14** | Webhook capture not idempotent under concurrency — 6 replays → 6 duplicate status/audit/outbox rows + 6 SMS. | `services/payments.py` | ☐ Open |
| **H-15** | Cross-user idempotency-key leak — replaying another user's `client_request_id` returns their order number/total (201) and no-ops the caller's checkout. | `checkout.py:177-185` (no user_id filter) | ☐ Open |
| **H-16** | Header ⌘K search never submits — Enter fires no request; only preset chips work; no autocomplete. | storefront header search | ☐ Open |
| **H-17** | Order page hangs forever on an unknown order number — API 404, no error state. | `orders/[orderNumber]` | ☐ Open |
| **H-18** | Cart accepts quantities above available stock, no warning (checkout-place enforcement to re-verify). | storefront cart / PDP stepper | ☐ Open |
| **H-19** | Test/seed junk live in the customer catalogue — "xyz", "NoBrand Test Tonic" (₹0), "AUDIT-99 tablets" purchasable. | seed / audit test data | ☐ Open |
| **H-20** | Unmoderated reviews with no proof-of-purchase — a payload review dragged Amoxicillin to 1.0 (React escapes → no XSS exec). | `services/reviews.py:74` | ☐ Open |
| **H-21** | OTP entry doesn't auto-advance — typing/pasting a 6-digit code fills only box 1; signup/OTP login unusable. | storefront OTP inputs | ☐ Open |
| **H-22** | Role prices silently dropped when MRP is blank (success toast, tiers lost); `/track` has no order-number lookup despite 3 CTAs. | dashboard price editor; storefront `/track` | ☐ Open |

---

## MEDIUM (31) — grouped

**Money & tax**
- Free-shipping threshold applied to the ex-GST base (real cutoff ₹560, promised ₹499).
- Percent coupons discount the pre-tax base → "10% off" saves ~0.6%.
- A 100%-discount order still charges full GST.
- Refunds never restock inventory.

**Access & data**
- `users.status` defaults to `active` → any path not setting `pending_kyc` grants wholesale pricing (seeded retailer with zero KYC gets it).
- `/docs` + `/openapi.json` exposed unconditionally.
- "10 MB" upload cap is cosmetic on presigned PUTs (unenforced on the regulated KYC bucket).

**Ops & infra**
- Frontend containers run as root.
- No error tracking (Sentry) or metrics.
- No verified backups (PITR reliance; restore drill unchecked).
- Readiness probe checks DB but not Redis.
- Seed/reset scripts (with `Demo123!`) baked into the prod image; CI grep doesn't cover `backend/scripts`.

**Storefront**
- Cart has no order summary or coupon field.
- Guests hit dead-ends with no sign-in link.
- No pincode serviceability check anywhere.
- Chat FAB overlaps the mobile "Add to cart".
- "Get bulk quote" links to `/cart` instead of the enquiry flow.
- Missing page titles on 8 routes; no pagination on products/account.

**Dashboard**
- Failed saves are silent app-wide (a −100 receive shows nothing on 422).
- Stock can only ever increase (no adjust/write-off/cycle-count).
- No refund action in the UI; no COD-collection action.
- Category delete has no confirmation; role badge goes stale after switching accounts.
- Session desync / silent-session-death: a dead session still shows "logged in" and fails with a generic toast.

**Business rules**
- Discontinued products remain orderable and listed.
- No prescription gate on Schedule H/H1/X. **Owner decision 2026-08-01: add an Rx gate** (prescription upload + verification) as a dedicated later-phase workflow.
- No cumulative cart-quantity cap (2,997 units ordered via repeated adds).
- "Products by category" chart mis-buckets inactive products.

---

## LOW (40+) — summary

Raw enum leakage in the UI (`cod pending`); inconsistent date formats; broken images
(storage unconfigured / audit `images.example.com`); wrong category glyphs; anonymous
`/auth/refresh → 401` on every page load; no Privacy/Terms/Contact/Returns pages; placeholder
founder/contact content on the public About page; sequence gaps burned on failed checkouts;
empty-cart reporting ₹50 shipping; dead code (`ProductReviews.tsx`, ~5,000 lines orphaned CSS,
TanStack Query installed-unused); dead `NEXT_PUBLIC_WS_BASE`; stale "STUB" docstrings; 67
endpoints without a `response_model` (dict-returning admin/analytics subset drives frontend
contract drift, incl. `AdminOrder.customer_name` which doesn't exist in the schema); dead
duplicate `_quote_bands` in `enquiries.py`; 22 ruff import-order + 23 mypy findings (mostly noise).

---

## Verified solid (attacked / reconciled, not assumed)

- Line-level tax math exact across 25,035 amounts × 5 GST rates — zero mismatches.
- Cart-checkout inventory truly race-safe (`FOR UPDATE`, deterministic lock order; 4-way race → 1 winner; clean partial rollback).
- RBAC under attack: tampered/`alg:none`/expired/phone-proof tokens all 401; customer → 403 everywhere; logout revokes access token immediately; refresh reuse-detection nukes the chain; suspended-user lockout; no user enumeration.
- Transactional outbox → real GST-invoice PDF whose bytes/content match the order.
- COD payment gate: env-driven, enforced at quote + place, fails closed.
- RFQ approval workflow: price bands (floor+ceiling), maker-checker, no accept-before-approve, no double-convert.
- IDOR guards on orders/enquiries/chat/KYC; SQLi neutralised; mass-assignment blocked; CORS rejects evil origins; no secrets/PII in responses or bundles.
- Core dashboard KPIs (revenue/orders/buyers/AOV, RFQ funnel) reconcile exactly to the DB.
- 201 backend tests pass; responsive passes; zero console errors on storefront.

---

## Remediation plan — four gates (ordered by risk, not effort)

### Gate 1 · Money & data integrity — *stop the bleeding*
- **Lock the unlocked writes (CR-1, H-7, H-14):** `SELECT … FOR UPDATE` on refund / coupon-redemption / webhook-capture; DB constraints (`sum(refunds) ≤ payment.amount`, atomic `used_count = used_count + 1`). One pattern closes a critical + two highs.
- **Reserve stock on RFQ conversion (CR-2)**; make fulfilment raise on shortfall instead of absorbing it; add a ledger-vs-levels reconciliation check.
- **Fix the un-awaited refund (H-3);** default new variants to tracked or block checkout on untracked (H-6).
- **Correct the tax base (H-9):** GST on `subtotal − discount`; add GSTIN + CGST/SGST/IGST to the invoice; fix double-counted analytics revenue (H-10).

### Gate 2 · Security & deploy — *close the doors*
- **Order-tracking IDOR (H-1):** require authenticated owner when `phone_last4` absent; fail-closed; rate-limit; non-sequential tracking tokens.
- **DoS hardening (H-2):** body-size + JSON-depth guard before validation; defensive error handler.
- **Deploy blueprint (CR-3):** real SMS provider + **DLT registration (long lead time — start now)**, R2 secrets, custom domains, non-root frontend containers, gate `/docs` in prod, stop baking seed scripts into the image.
- **Scope sales order access (H-11)** to assignments, or confirm the shared queue is intended and document it.

### Gate 3 · Usability & correctness — *make it work for real users*
- **Search (CR-4)** with prefix/fuzzy/multi-word; fix ⌘K submit (H-16); role pricing on listings (CR-5).
- **Fix** the unreachable pack-size menu (H-12), 403-as-data (H-13), OTP auto-advance (H-21), infinite order-load (H-17); add COD-collection + refund actions (H-5).
- **Purge test data (H-19);** add review moderation + proof-of-purchase (H-20); build `/track` lookup (H-22).
- **Session UX:** detect the 401, clear logged-in state, prompt re-login (the silent-session-death bug).

### Gate 4 · Operability — *run it safely*
- **Test on migrations, not `create_all` (H-4);** add `alembic upgrade head && alembic check` to CI; build Docker images in CI.
- **Wire error tracking (Sentry) + metrics;** confirm backups + one restore drill; object versioning/retention for KYC/invoice buckets.
- **Clear the medium/low backlog** — cart summary, pagination, page titles, legal pages, dead-code cleanup.

---

## Environment cleanup owed

The audit created records in the dev DB: orders `NS-2026-00016`–`00039`, enquiries
`ENQ-2026-00013/00014`, several `AUDIT-`prefixed products/variants/users/employees, disabled
`AUDIT` coupons, an XSS-payload review on Amoxicillin, ~179 revoked sessions on `+919800000001`,
and mutated stock/order states. A **DB reset + reseed** is the clean fix before further testing or
client screenshots.
