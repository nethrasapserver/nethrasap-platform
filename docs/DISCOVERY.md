# Nethrasap Platform — Discovery Report & Migration Roadmap

*Phase 1 (platform deep analysis) + Phase 2 (three-repo comparison).*
*Generated 2026-07-19. No code was changed. This document seeds the migration log.*

---

## 1. Executive summary

The platform repo is **not** an early prototype — it is a disciplined, phase-built monorepo
(B0–B7 committed) that is substantially production-shaped already:

- **Backend** (~18k LOC FastAPI + SQLAlchemy 2 async + Postgres + Redis + arq): clean
  route→service→model layering, integer-paise money, snapshot-based orders, append-only
  stock ledger with row-locked reservations, Argon2 + rotating refresh tokens with reuse
  detection, purpose-bound OTP proofs, DB-driven RBAC with instant permission invalidation,
  129 tests against real Postgres.
- **Frontends** (Next.js 14 App Router ×2 + generated OpenAPI types): strict TS, zero `any`,
  zero mock data, SSR for the public catalogue.
- **Infra**: docker-compose dev stack, hardened non-root Dockerfiles, CI with lint + mypy +
  pytest (real Postgres/Redis services) + a no-mock grep gate, Render blueprint.

The verdict from comparing all three repos: **the backend is a strict superset of the demo
backend — nothing was dropped.** The real gap is almost entirely **frontend consumption**:
large backend domains (reviews, notifications, enquiries, chat, KYC upload, invoices,
tracking) have **no UI consuming them** on the storefront, and the dashboard is missing the
analytics/admin/CMS/settings surface the mock envisions.

**Production blockers found (backend):** no real SMS provider (OTP delivery is console-only),
invoice/payslip PDFs stubbed, coupon `used_count` race condition, no centralized exception
handler, no security headers, several unbounded list endpoints, stale `requirements.txt`.

**Frontend blockers:** Razorpay checkout is a placeholder comment, `/track` is a dead nav
link, KYC upload is a stub, the promised OpenAPI-drift CI check does not exist, refresh
tokens are in `localStorage` (contradicting code comments claiming httpOnly cookies).

---

## 2. Repository roles (confirmed)

| Repo | Role | Status |
|---|---|---|
| `nethrasap-platform` | Source of truth. Monorepo: `backend/`, `apps/storefront`, `apps/dashboard`, `packages/api-client` | Active, clean tree, last commit 2026-07-12 |
| `backups/nethrasap-dashboard-mock` | PRD reference — every intended screen/role/workflow | Read-only reference |
| `backups/nethrasap-ecommerce-app-demo` | Storefront UX reference (Vite SPA + demo FastAPI) | Read-only reference |

**Locked platform decisions** (docs/PLAN.md, 2026-07-11) that supersede any generic checklist:
phone-first auth (**no email anywhere**), PostgreSQL 16 + Alembic, single monorepo, Razorpay,
Cloudflare R2, arq jobs, WebSocket hub + Redis pub/sub, Next.js SSR storefront, real
chat domain (not a scripted bot alone).

---

## 3. Current architecture

```
storefront (Next.js 14, :3000) ─┐   REST /api/v1 (~110 endpoints, 21 routers)
                                ├─▶ FastAPI ── services ── SQLAlchemy 2 ── Postgres 16
dashboard  (Next.js 14, :3001) ─┘        │                                    ▲
        ▲  packages/api-client           ├── Redis: rate-limit · RBAC pv ·    │
        │  (openapi-typescript)          │   WS tickets · pub/sub `rt:*`      │
        └── WS /ws (ticket auth) ◀───────┤                                    │
                                         └── arq worker: sms · invoice PDFs ──┘
Integrations: Razorpay (real+stub) · R2 storage (real+stub) · SMS (console only)
```

### 3.1 Backend layering (verified clean)

`api/v1/*` routes are thin adapters → `services/*` (21 modules, all business logic) →
`models/*` (39 models, 15 files) with `schemas/*` Pydantic v2 contracts. `deps.py` carries
auth/RBAC/pagination/cart-cookie dependencies. Minor boundary leaks: routers importing
service-private helpers (`enquiries._serialise`, `deps._token_claims` from realtime,
`catalogue._price_role_for_user` from checkout).

### 3.2 Database (39 models, 10 linear migrations)

- Identity: `users` (phone E.164 unique = identity), `user_profiles`, `addresses`,
  `sessions` (hashed rotating refresh tokens, rotation chain).
- RBAC: `roles` / `permissions` / `role_permissions` (DB-driven, unique resource+action).
- Catalogue: categories (self-ref), products (GIN full-text `search_tsv`, GST rate,
  schedule H/H1/X, HSN), variants, **role-aware prices** with validity windows + partial
  unique index, images, reviews (1-per-user, trigger-maintained rating).
- Cart: user OR anon-session carts (check constraint), price-snapshot items, coupons.
- Orders: NS-numbered, 9-state enum, full paise breakdown, address+line snapshots,
  `client_request_id` idempotency, status history, payments/refunds/invoices/shipments.
- Inventory: warehouses, stock_levels (reserved ≤ on_hand checks), append-only ledger.
- Domains: KYC (verification_requests + kyc_documents), enquiries (RFQ + messages +
  history), chat (conversations/messages/read cursors), notifications, sales org
  (assignments + targets), HR (employees/attendance/leave/holidays/payroll/payslips),
  CMS (pages/blocks/settings/feature_flags), append-only audit_log.
- Money: integer paise everywhere; GST ROUND_HALF_UP centralized in `services/pricing.py`.
- Soft delete: selective (`ended_at`, `revoked_at`, `valid_to`, `is_active` flags), not
  global `deleted_at` — acceptable given snapshotting; revisit per-entity if required.

### 3.3 Auth & security (strong core, specific gaps)

Implemented well: Argon2id; 15-min JWTs carrying `perm` claims + `pv` permission-version
(Redis-checked, instant invalidation on role edits); opaque hashed refresh tokens with
**rotation + reuse detection that burns all sessions**; hashed purpose-bound OTPs (TTL,
attempt caps, cooldown, row-locked verify, constant-time compare); Redis rate limits on
OTP/login (fail-closed in prod); prod boot refusal on placeholder JWT secret; webhook
HMAC over raw body (503 if unconfigured outside dev).

Gaps (see §6 backlog): no per-account lockout, no session-list/logout-everywhere
endpoints, `current_user` doesn't re-check `pv`/user status (only `require_permission`
does), no security-headers middleware, broad CORS methods/headers, no access-token
denylist (acceptable at 15-min TTL if suspend re-check lands).

### 3.4 API surface

~110 endpoints, 21 routers, `/api/v1` versioning. Public catalogue uses a consistent
`Paginated[T]` envelope; **many staff/admin lists return bare `list[...]` with no
pagination** (enquiries, chat inbox, cms, inventory, ledger, warehouses, hr, sales,
notifications). Ownership checks enforced in services (orders, chat, enquiries). Some
endpoints return untyped `dict` (reorder, invoice, notifications, analytics, hr, flags),
weakening the generated TS types.

### 3.5 Realtime & jobs

WS hub per API process; single Redis pattern-subscription `rt:*`; **30s single-use ticket
auth** (tokens never in URLs); channels `user:/role:/conv:/topic:`; single `publish_event()`
chokepoint called post-commit; envelope carries ids only (clients refetch). arq worker:
`send_sms_task`, `generate_invoice_pdf`, `generate_payslips` (PDF bytes currently stubbed);
inline-in-dev / raise-in-prod enqueue degradation.

### 3.6 Frontends

**Storefront** (10 routes): SSR for home/products/PDP/categories (`serverApi()`), client
for auth/cart/checkout/account/orders. Phone OTP login+signup wired. Server-authoritative
cart with anon-cookie merge. WS live updates on order detail only. Zero mock data.
**Dashboard** (14 routes): single permission-gated staff console (`can()` wildcard
matching); orders w/ dispatch+refund modals, KYC queue, catalogue/inventory/enquiries
CRUD, chat inbox (4s polling — no WS), team, audit, HR (employees/leave/payroll). No
`middleware.ts` in either app — all guarding is client-side + backend enforcement.
**api-client**: `openapi-typescript` generated `schema.d.ts` (8.2k lines) + hand-written
fetch/WS wrapper; consumed as raw TS by both apps.

### 3.7 Tooling / CI / infra

CI: no-mock grep gate; backend ruff + mypy + pytest against real Postgres/Redis;
frontend typecheck + build. Local: Makefile targets, compose infra/app profiles,
multi-stage non-root Dockerfiles (uv-locked backend, standalone Next output). mypy is
`strict = false` (debt). No frontend lint/test step in CI. No OpenAPI drift check
despite comments claiming one.

---

## 4. Phase 2 — Repo comparison (gap analysis)

### 4.1 Storefront: demo → platform (backend superset confirmed)

Platform backend keeps demo pricing/checkout/orders logic byte-equivalent (GST rounding,
shipping thresholds, coupon rules, cancel/reorder/track-by-phone-last-4) and **adds**
enquiries, chat, notifications, payments, cms, hr, inventory, kyc, analytics, invoices.

**Missing on the platform storefront UI** (backend support already exists unless noted):

| Gap | Notes |
|---|---|
| `/track` page | **Broken link** — Shell links to it twice; no page exists. Backend `GET /orders/{n}/track` ready |
| Reviews UI | PDP has no stars/list/form; reviews API + trigger-maintained ratings unused |
| Notifications UI | No bell/inbox; API exists |
| Enquiry/RFQ flow | No customer create/thread/accept-quote UI; full API exists |
| Chat widget | No customer chat; conversations API + staff inbox exist |
| Razorpay modal | Placeholder comment; falls back to COD. Backend order+confirm+webhook ready |
| KYC upload | Account page says "coming next"; upload/submit/status APIs ready |
| Account area | No profile edit, no address book CRUD (backend has addresses) |
| Search page / overlay | No dedicated search UX; API `q` full-text ready |
| Wishlist, compare | Demo-only (localStorage); **no backend tables** — needs product decision |
| Confirmation page, invoice link | Checkout redirects to order page; `/orders/[n]/invoice` route missing (dead link) |
| Forgot-password flow | Backend `/auth/password/reset` exists (OTP-proof); no page |
| Policy/offline/500 pages | Absent |
| Richer home/footer/mega-menu | Certificates, FAQ, buyer segments — CMS-driven content, partially needs CMS blocks |
| Checkout methods | Demo modeled upi/card/netbanking/wallet; platform UI = COD + stub UPI |

### 4.2 Dashboard: mock (PRD) → platform

Platform implements the **internal ops core** (orders, KYC queue, catalogue, inventory,
enquiries, chat inbox, team, HR core, audit). Missing vs the mock's product vision:

| Area | Missing |
|---|---|
| Analytics | admin/manager/sales analytics pages, charts, KPI buckets, revenue trend (backend `/analytics/*` partially ready) |
| RBAC admin | Role editor UI (backend roles/permissions CRUD-ready via models; check endpoints) |
| User management | Combined internal+external user CRUD (`admin-users`) |
| Categories UI | Dedicated category management (backend ready) |
| CMS + page editor | Hero slides, FAQs, certificates, policies (backend cms_pages/blocks ready) |
| Settings | General/payment/SMS/storage/**feature flags**/security/health panel (backend app_settings + feature_flags ready) |
| Notifications center | No dashboard notifications UI |
| HR | Attendance calendar, holidays CRUD (backend tables + endpoints exist) |
| Verification depth | Mock has OCR-extracted fields w/ confidence, request-more-docs, flag-for-review, manager override; platform has approve/reject |
| Product form depth | Mock's full pharma form (images gallery, schedule, HSN, batch/expiry) vs platform's basic modal |
| Realtime | Dashboard uses 4s polling for chat; no WS anywhere despite shared helper |
| Customer portal | Mock's buyer portal (dashboard/profile/addresses/orders/enquiries/notifications) — **decision**: platform direction puts buyers in the storefront account area, not the dashboard |

### 4.3 Brief-vs-locked-decisions conflicts (flagged, not actioned)

- Generic brief lists *email verification* — **overridden** by locked phone-first/no-email decision.
- Brief lists *multi-store/marketplace* — not in current schema; treat as future-proofing concern only (category/product/warehouse models would need a store/tenant dimension later).
- Mock has 4 separate portal shells; platform chose one permission-gated console. Recommend **keeping the unified console** (less duplication, RBAC already capability-based) and adding role-specific landing dashboards.

---

## 5. Technical debt register

**Backend**
1. Coupon `used_count += 1` non-atomic (checkout.py) — oversell of limited coupons under concurrency.
2. No centralized exception handler; `ErrorResponse` schema defined but never wired; no request-id correlation.
3. Unbounded list endpoints (admin/staff lists, notifications).
4. `refresh_product_status` loops per variant (N aggregate queries per order).
5. `requirements.txt` stale 4-line stub (deps live in pyproject/uv.lock) — delete or generate.
6. Tests build schema via `create_all` + hand-copied DDL, not Alembic — migrations untested; `uq_product_prices_active` and sales-assignment partial indexes absent from test schema.
7. mypy `strict = false`.
8. No account lockout; no session management endpoints; `current_user` skips `pv`/status re-check; no security headers; CORS `*` methods/headers.
9. SMS providers (msg91/exotel/twilio) `NotImplementedError`; invoice/payslip PDF bytes stubbed.
10. No analytics/catalogue caching; missing indexes worth adding: `orders(user_id, created_at)`, `notifications(user_id, read_at)`.
11. Private-helper imports across layer boundaries (`_serialise`, `_token_claims`, `_price_role_for_user`).

**Frontend**
1. OpenAPI drift check claimed in comments but absent from CI.
2. Refresh token in `localStorage` while comments claim httpOnly cookie — decide and align (recommend httpOnly cookie for refresh).
3. Dead links: `/track`, `/orders/[n]/invoice`. KYC upload stub.
4. Dashboard login page hardcodes demo creds `9800000006 / Demo123!`; the no-mock CI grep doesn't scan `apps/dashboard` — both need fixing.
5. TanStack Query installed + mounted but unused (manual `useEffect` fetching; bespoke `useApi` in dashboard) — adopt or remove.
6. Duplicated `lib/` (api, auth, toast, format) across both apps → shared package.
7. Swallowed errors: failed fetches render as empty states; chat actions lack try/catch.
8. Orphaned assets: `lib/icons.js`, `lib/images.js`, 9 unused CSS files (~150KB).
9. Hand-declared local interfaces shadowing generated types (drift risk).
10. Accessibility: unlabeled steppers, non-keyboard row clicks, no modal focus trap/Escape.
11. `NEXT_PUBLIC_WS_BASE` documented but unread; storefront `images.remotePatterns` lacks the R2 host.
12. No `middleware.ts` edge guards (client-side only; backend does enforce).

---

## 6. Migration roadmap (proposed — awaiting approval)

Ordered to make the local platform cohesive and production-grade; each workstream =
small atomic commits, migration-log entry, tests.

**W0 — Platform hardening (backend foundations)** *(prereq for everything)*
Centralized exception envelope + request-id middleware + security headers; account
lockout + session management endpoints (`GET /auth/sessions`, `DELETE /auth/sessions[/{id}]`,
logout-everywhere) + `pv`/status re-check in `current_user`; fix coupon race
(atomic `UPDATE … WHERE used_count < max_uses`); paginate all staff lists; run tests
through Alembic-built schema; delete stale requirements.txt; CI: OpenAPI drift check,
extend no-mock grep to `apps/dashboard`, remove hardcoded demo creds; mypy strict ratchet.

**W1 — Shared frontend foundation**
Extract duplicated `lib/` into `packages/` (api/auth/toast/format/ws); refresh token →
httpOnly cookie; adopt TanStack Query (or remove it); error-state components; delete
orphaned assets; `middleware.ts` route guards.

**W2 — Storefront completion (backend already ready)**
Track page (fix dead link) → reviews UI → notifications → account (profile + addresses)
→ KYC upload → forgot password → search → confirmation + invoice page → policy pages.

**W3 — Payments end-to-end**
Razorpay modal + confirm + webhook wiring; real invoice PDF generation (reportlab is
already a dependency) + R2 storage; checkout method decision (which methods to expose).

**W4 — Customer engagement**
Storefront enquiry/RFQ flow + chat widget; dashboard WS adoption (replace chat polling);
notifications center both apps.

**W5 — Dashboard admin surface**
Analytics pages (existing endpoints + rollups), RBAC role editor, user management,
categories UI, CMS editor + settings + feature flags, verification depth
(request-more-docs / flag / override), full product form, HR attendance + holidays.

**W6 — Launch readiness (local)**
Real SMS provider implementation behind existing interface; catalogue/analytics caching;
`refresh_product_status` batching; load/concurrency tests (reservation, coupons);
accessibility pass; observability wiring (request logs w/ ids, audit coverage review).

**Product decisions (resolved 2026-07-19):**
1. Wishlist & compare: **built as real backend domains** with realtime sync (see §8).
2. Checkout payment methods: **COD only at launch**, config-driven via `PAYMENT_METHODS_ENABLED`;
   UPI/card/netbanking/wallet re-enable by env change + the gateway modal (W3).
3. Customer "portal": buyers live in storefront `/account` (pending explicit confirmation).
4. Multi-store/marketplace: **explicitly out of scope** — single-tenant schema stands.

---

## 7. Migration log

| Date | Decision | Rationale |
|---|---|---|
| 2026-07-19 | Discovery report created; no code changed | Phase 1+2 of agreed process |
| 2026-07-19 | Recommend keeping unified permission-gated dashboard over mock's 4 portal shells | RBAC already capability-based; avoids 4× duplication |
| 2026-07-19 | Recommend httpOnly-cookie refresh tokens | Aligns implementation with documented intent; shrinks XSS surface |
| 2026-07-19 | Wishlist + compare become server-side domains (migration 0011), realtime-synced over the user WS channel | Cross-device continuity; demo's localStorage approach loses data and can't sync |
| 2026-07-19 | Compare tray capped at 4 (service-enforced 409) | Side-by-side table readability; matches demo UX |
| 2026-07-19 | Payment-method availability is config-driven (`PAYMENT_METHODS_ENABLED=cod`); registry + gating live in `services/payment_methods.py`; storefront renders `GET /checkout/payment-methods`, never a hardcoded list | COD-only launch without deleting the (working, tested) Razorpay stub path; re-enabling gateway methods is env + modal work, no backend changes |
| 2026-07-19 | Multi-store/tenancy explicitly deferred | Owner decision; single-tenant schema stands |

## 8. Session log — 2026-07-19 (saved items + payment gating)

**New backend surface:** `wishlist_items`/`compare_items` tables (0011);
`services/saved_items.py` (idempotent add/remove, compare cap, post-commit
`wishlist.updated`/`compare.updated` events); routers `GET|PUT|DELETE
/wishlist[/items/{product_id}]`, `GET|PUT|DELETE /compare[...]`, `DELETE /compare`;
`GET /checkout/payment-methods`; checkout quote/place now validate against the
enabled-method set. Public aliases `price_role_for_user` / `serialize_product_card`
added so new services stop importing catalogue privates.

**Storefront:** `SavedProvider` (loads lists, WS subscription with 5s-backoff
reconnect, cross-device refetch), heart/compare toggles on `ProductCard` +
`BuyBox`, `/wishlist` and `/compare` pages, header links, checkout payment
methods rendered from the API (COD only appears).

**Verification (2026-07-19, full Docker stack):** all 5 services healthy;
migrations 0001–0011 applied; RBAC + dev catalogue seeded; **140/140 tests
pass** inside the api container; both Next builds green; api-client
`schema.d.ts` regenerated from the live OpenAPI (+417 lines, additive).

**Bugs found & fixed during bring-up:**
1. Compose passed `API_PROXY_TARGET` only as a build arg — SSR server
   components read it at runtime → storefront 500. Fixed: runtime `environment:`
   on storefront/dashboard services.
2. Stray `backend/__init__.py` (scaffold cruft) made `/app` importable as a
   package named `app` inside Docker, shadowing the real `app` package and
   breaking pytest there. Deleted.
3. Saved-items idempotent re-add used IntegrityError+rollback — rollback
   expires loaded instances mid-request → MissingGreenlet 500 on double-add.
   Fixed with atomic `INSERT … ON CONFLICT DO NOTHING`. (Caught by the new tests.)
4. Next 14 data cache persisted pre-seed empty API responses on disk despite
   `force-dynamic` — admin changes wouldn't appear until container recreation.
   Fixed: `cache: "no-store"` in the shared api-client fetch.

**Remaining follow-up:** swap the temporary local `WishlistOut`/`CompareOut`/
`PaymentMethodsResponse` interfaces in `apps/storefront` for the now-generated
`Schemas[...]` aliases (cosmetic; shapes are identical).
