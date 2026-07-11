# Nethrasap — Production Build Plan

One backend, two frontends, fully realtime, **zero mock/hardcoded data**.
Source material: `../backups/nethrasap-ecommerce-app-demo` (FastAPI + Vite demo)
and `../backups/nethrasap-dashboard-mock` (Next.js UI prototype) — kept as
read-only references.

## Locked decisions (2026-07-11)
- **Database:** PostgreSQL 16 (kept — the existing SQLAlchemy/Alembic layer is the foundation). Hosted on Render Postgres.
- **Hosting:** Render (API, worker, Postgres, Redis) + Cloudflare (Pages for both frontends, R2 for object storage, DNS/CDN).
- **Repo:** single monorepo (this repo): `backend/`, `apps/storefront/`, `apps/dashboard/`, `packages/api-client/`.
- **Auth:** phone number + password and phone OTP. **No email anywhere** — the email integration stub and any email fields/flows are removed. SMS runs in `console` provider mode locally; real provider (MSG91/Exotel/Twilio) plugged in later via env only.
- **Chat:** the scripted chatbot is replaced by a real **customer ↔ sales/manager messaging domain** (conversations, messages, assignment), surfaced as an inbox in the dashboard and a chat widget in the storefront, realtime over WebSockets.
- **Storefront:** Next.js (SSR) — organic search is a requirement, so product/category pages must be server-rendered and crawlable. The Vite SPA is the visual reference only; its mock adapter is not carried over.
- **Realtime:** WebSocket hub on the API + Redis pub/sub. Single `publish_event()` choke point in the service layer; clients subscribe per user/role/topic channels.
- **Jobs:** arq (Redis) — SMS dispatch, webhook processing, invoice/payslip PDFs, payroll runs, analytics rollups, cleanup.

## Architecture
```
storefront (Next.js, CF Pages) ─┐
                                ├─▶ FastAPI on Render: REST /api/v1 + WS /ws
dashboard  (Next.js, CF Pages) ─┘        │
                                Postgres (Render) · Redis pub/sub + arq
                                Razorpay webhooks · Cloudflare R2 · SMS provider
```
Shared `packages/api-client` generates TS types from the live OpenAPI schema
(`make api-types`); CI fails on drift.

## Backend work map
**Keep:** auth core (JWT + rotating hashed refresh tokens), users/RBAC/catalogue/
cart/orders/payments models, Alembic pipeline, paise+GST pricing, audit log.

**Change:**
- Identity becomes **phone-first**: phone unique + verified via OTP; drop email
  columns/flows; login = phone+password or phone+OTP.
- RBAC enforced via `require_permission("resource:action")` dependency (perm
  claims in JWT, cache-busted on role edits).
- Config hardening: refuse placeholder `JWT_SECRET` outside dev; secure cookies;
  Redis-backed rate limiting on auth/OTP/webhooks.
- Delete `integrations/email.py`; implement real `razorpay.py` (+ `POST
  /payments/webhook`), `storage.py` → R2, new `sms.py` (console|msg91|exotel).

**New domains** (each = migration + models + service + router + WS events):
| Domain | Tables |
|---|---|
| Enquiries (RFQ) | enquiries, enquiry_items, enquiry_messages, enquiry_status_history |
| Chat | conversations, conversation_participants, messages, message_reads |
| Notifications | notifications |
| KYC / verifications | verification_requests, kyc_documents |
| Inventory | warehouses, stock_levels, stock_ledger, stock_adjustments |
| Sales org | sales_assignments, sales_targets |
| HR | employees, attendance_records, leave_types, leave_requests, leave_balances, holidays, payroll_runs, payslips |
| CMS & settings | cms_pages, cms_blocks, app_settings, feature_flags |
| Analytics | daily_sales_rollup, product_performance_rollup |
Plus full admin CRUD on existing catalogue/users/roles/coupons + CSV import
(replaces the deleted `seed_data.json` pipeline).

## Frontend work map
**Storefront (`apps/storefront`)** — port pages from the Vite SPA against live
APIs, in order: shell/nav → home (CMS-driven) → product list/detail (SSR) →
cart → checkout (Razorpay modal) → orders + live tracking → auth (phone OTP)
→ enquiries → notifications → chat widget.

**Dashboard (`apps/dashboard`)** — extract from `components/legacy.tsx`
portal-by-portal into typed components; route groups `(auth) (customer) (sales)
(manager) (admin) (hr)` with `middleware.ts` role guards; all CRUD + KPIs on
live endpoints; chat inbox for sales/managers; demo-access grid dev-only.

## Phases (each ends deployed to staging, acceptance test passing)
0. **Foundation** — this repo, CI, Dockerfile, Render blueprint, CF Pages, config hardening. ✅ scaffolded
1. **Identity** — phone/OTP auth, email removal, KYC upload+approval, RBAC enforcement, dashboard guards.
   *Done when:* retailer signs up by phone, uploads KYC, sales approves, wholesale prices unlock.
2. **Storefront live** — catalogue/cart/orders/reviews/addresses wired, admin catalogue CRUD + CSV import, CMS-driven home, SSR product pages.
   *Done when:* product created in admin appears on the storefront; network tab shows only real API calls.
3. **Money & fulfillment** — Razorpay live + webhook, invoice PDFs to R2, shipments, atomic inventory reservation, SMS notifications (console).
   *Done when:* test-mode payment completes via webhook, stock decrements, invoice downloadable.
4. **Realtime spine** — WS hub, Redis pub/sub, notifications, chat domain, live tracking/KPIs/inventory alerts.
   *Done when:* order placed in one browser updates sales dashboard + customer tracking in another, unrefreshed, <1s.
5. **Ops portals** — enquiries lifecycle, sales org/performance, manager analytics (rollups), admin users/roles/settings/CMS editor, audit viewer, chat inbox.
   *Done when:* grep for NETHRA_DATA / Math.random in app code returns nothing.
6. **HR portal** — employees, attendance, leave, holidays, payroll runs + payslip PDFs.
7. **Launch** — rate limits, security review, load test, monitoring (Sentry/OTEL), backup restore drill, DNS cutover.

## No-mock enforcement
- CI greps app code for `NETHRA_DATA`, `mock-adapter`, `VITE_MOCK_MODE`, `Demo123!` — build fails on hit.
- Seeds are dev-only fixtures; production data enters via admin UI / CSV import.
- Every dashboard number must be traceable to a database row.
