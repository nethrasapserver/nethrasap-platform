# Backend — Production Build Plan

Scope: everything server-side needed to back **both** frontends (storefront +
dashboard portals) with zero mock data and realtime updates. Companion to
[PLAN.md](PLAN.md); this file is the backend work order.

## 0. Starting point (what we keep vs change)

**Keep (already production-grade):** async SQLAlchemy 2 models for
users/RBAC/catalogue/cart/orders/payments, Alembic pipeline + DB triggers
(tsvector search, rating recompute, order-number sequence), JWT access +
rotating hashed refresh tokens with reuse detection, Argon2 hashing, paise
integer money + GST rounding, idempotent checkout, audit_log table, structlog,
pytest suite.

**Change:** phone-first identity (email removed everywhere), RBAC actually
enforced, integrations made real (Razorpay/R2/SMS; email deleted), Redis put to
work (pub/sub, arq, rate limits), and ~10 new domains added.

## 1. Target module layout

```
backend/app/
  api/v1/                    # routers, thin: validate → service → response
    auth.py products.py categories.py cart.py checkout.py orders.py
    coupons.py reviews.py health.py
    kyc.py verifications.py enquiries.py chat.py notifications.py
    inventory.py sales.py hr.py cms.py settings.py analytics.py
    payments.py            # webhook + admin refunds
    admin/                 # staff-only CRUD: products.py categories.py
                           # users.py roles.py coupons.py imports.py audit.py
  services/                # all business logic + the ONLY place events publish
  models/                  # one file per domain
  schemas/                 # pydantic request/response per domain
  integrations/
    sms.py                 # provider interface: console | msg91 | exotel | twilio
    storage.py             # Cloudflare R2 (S3 API): presigned PUT/GET
    razorpay.py            # real orders, capture, refunds, HMAC verify
                           # email.py DELETED — no email on this platform
  realtime/
    hub.py                 # WS connection manager + Redis pub/sub bridge
    channels.py            # channel naming + authorization rules
    events.py              # publish_event() — single choke point
  worker.py                # arq WorkerSettings + task registry
  deps.py                  # + require_permission("resource:action")
  config.py                # hardened settings
```

Rules:
- Routers never touch the DB directly; services own transactions.
- Every mutating service publishes a domain event **after commit** via
  `publish_event()` — realtime is a side effect of the write path, never a
  separate code path someone can forget.
- Every staff mutation writes `audit_log`.

## 2. Workstream B0 — Foundation & hardening (prerequisite for everything)

1. **Config**: refuse to boot with placeholder `JWT_SECRET` when
   `ENVIRONMENT != dev`; `secure=True, samesite=lax` cookies; settings for
   SMS/R2/Razorpay; delete all email settings.
2. **Phone-first identity migration** (single Alembic revision):
   - `users.phone` → unique, indexed, E.164 normalized; `phone_verified_at`.
   - Drop `users.email` + every email column/flow; identity claims use phone.
   - New `otp_codes` table: `id, phone, purpose(signup|login|reset), code_hash,
     expires_at, attempts, consumed_at` — codes hashed, 6 digits, 5-min TTL,
     max 5 attempts, resend cooldown.
3. **SMS integration**: provider interface + `console` implementation (logs
   OTP to stdout in dev). Real provider = new class + env change only.
4. **RBAC enforcement**: `require_permission("orders:read_all")` dependency;
   permissions loaded into JWT `perm` claim at login; bump a per-role version
   in Redis on role edits so stale tokens re-resolve.
5. **Rate limiting** (Redis, sliding window): OTP request (per phone + per IP),
   login, webhook, chat message endpoints. Login lockout with backoff.
6. **arq worker skeleton** (`app/worker.py`) + Render worker service.
7. **Realtime skeleton**: `POST /realtime/ticket` (one-time, 30s TTL) →
   `GET /ws?ticket=…`; hub subscribes the socket to its authorized channels;
   Redis pub/sub bridge so any API/worker process can fan out.
8. **Conventions**: cursor pagination everywhere (`?cursor=&limit=`), RFC-7807
   style error body, `X-Request-ID` propagation into logs/audit.

**Acceptance:** phone signup/login/reset with console OTP end-to-end; WS
connects and receives a `ping` event published from a worker process; boot
fails on placeholder secret with `ENVIRONMENT=production`.

## 3. Workstream B1 — KYC & verification

Tables:
- `verification_requests`: id, user_id, status(pending|approved|rejected),
  doc_type, credential_no, reviewed_by, reviewed_at, review_notes, expires_at
- `kyc_documents`: id, request_id, doc_type(council_cert|cdsco_20b_21b|gstin|
  hospital_license), storage_key, content_type, size, uploaded_at

Endpoints:
- User: `POST /kyc/uploads` (presigned R2 PUT to a **private** bucket),
  `POST /kyc/submit`, `GET /kyc/status`
- Staff (sales/manager, `verifications:review`): `GET /verifications`
  (queue, filters), `GET /verifications/{id}` (+ presigned GETs),
  `POST /verifications/{id}/approve|reject` → flips user
  `pending_kyc → active` (or back), unlocking tier pricing.

Events: `verification.submitted` → `role:sales`; `verification.decided` →
`user:{id}`. SMS on decision.

## 4. Workstream B2 — Admin catalogue CRUD + CSV import + CMS

- Full write endpoints under `/admin`: products (+ variants, role-tier prices,
  images via presigned upload to the **public** bucket), categories, coupons,
  publish/unpublish. Existing storefront read endpoints untouched.
- `POST /admin/catalogue/import` — CSV upload → arq job → row-level result
  report. **This replaces the deleted `seed_data.json` pipeline**; production
  catalogue only ever enters via UI or import.
- CMS tables: `cms_pages`, `cms_blocks` (hero slides, promos, FAQs, policies,
  trust stats — everything currently hardcoded prose in the mocks),
  `app_settings` (typed key/value), `feature_flags`. Public read endpoints for
  the storefront home/policies; admin editor endpoints.

Events: `product.updated` / `cms.updated` → `topic:catalogue` (storefront
revalidates); all mutations audited.

## 5. Workstream B3 — Inventory (real stock)

Tables:
- `warehouses`; `stock_levels` (variant_id, warehouse_id, on_hand, reserved,
  reorder_point); `stock_ledger` — append-only movements
  (receipt|reservation|release|fulfillment|adjustment, qty, actor, ref_type/id);
  `stock_adjustments` (reason-coded, audited).

Behavior:
- Checkout **reserves atomically** (`SELECT … FOR UPDATE`) at place; cancel
  releases; fulfillment converts reservation → deduction. Oversell impossible
  by construction.
- `products.stock_status` becomes **derived** from stock_levels (trigger or
  service-maintained) — no more hand-set labels.
- Low-stock scan job → notification + `topic:inventory` event.

Endpoints: admin list/adjust/restock, ledger view; storefront sees only the
derived status.

## 6. Workstream B4 — Payments, invoices, shipments (make real)

- **Razorpay live**: real order creation (test keys first), client checkout
  payload, `POST /api/v1/payments/webhook` — HMAC verify (code exists, wire
  it), idempotent event processing via arq → payment captured → order
  confirmed → stock fulfilled → SMS + WS events. Admin refund endpoint →
  real refund + ledger release. COD unchanged.
- **Invoices**: on confirmation, arq job renders PDF (WeasyPrint) → R2 →
  `GET /orders/{no}/invoice` returns presigned URL.
- **Shipments**: staff create/update (courier, AWB, ETA, status) →
  `order.shipment_updated` events drive the customer's live tracking page.

## 7. Workstream B5 — Enquiries (RFQ) + Chat + Notifications

**Enquiries**: `enquiries` (customer_id, assigned_rep_id, status: pending|
quoted|confirmed|rejected|converted, totals), `enquiry_items`,
`enquiry_messages`, `enquiry_status_history`.
Customer: create from cart/product, list, detail, message. Staff: queue,
assign/claim, quote (line-level pricing), status transitions,
convert-to-order. Events to `role:sales` + participants.

**Chat** (replaces the scripted chatbot): `conversations` (customer_id,
assigned_to, status open|closed, last_message_at),
`conversation_participants`, `messages` (sender_id, body, attachment
storage_key?), `message_reads`.
Customer: one open conversation (`POST /chat/conversations`,
`POST …/messages`). Staff: inbox (unassigned/mine filters), claim, reply,
close. Delivery over WS channel `conv:{id}`; unassigned-message alerts to
`role:sales`/`role:manager`. Rate-limited; messages audited.

**Notifications**: `notifications` (user_id, type, title, body, link,
priority, read_at). Created by services via one helper (never ad-hoc), listed
+ mark-read endpoints, unread count, pushed over `user:{id}`.

## 8. Workstream B6 — Sales org & analytics

- `sales_assignments` (customer↔rep, active window), `sales_targets`
  (rep, period, target_paise).
- Rollups: `daily_sales_rollup`, `product_performance_rollup` — incremental
  update on order events + nightly reconciliation job.
- Endpoints: `/sales/team`, `/sales/performance` (rep), `/analytics/manager`,
  `/analytics/admin`, `/analytics/kpis?portal=…` — **every number the
  dashboards show comes from these**; KPI deltas stream over `topic:kpi`.
- `GET /admin/audit` — filterable audit viewer.

## 9. Workstream B7 — HR

Tables: `employees` (optional link to users, dept, position, dates, status),
`attendance_records` (check_in/out), `leave_types`, `leave_balances`,
`leave_requests` (status workflow), `holidays`, `payroll_runs`, `payslips`
(pdf storage_key).

Endpoints: employees CRUD (`hr:*` permissions), attendance check-in/out +
admin views, leave apply → approve/reject (balance-aware), holidays CRUD,
`POST /hr/payroll/runs` → arq job computes + renders payslip PDFs → R2.
Events: `leave.requested` → HR/admin; decisions → employee. SMS on payslip.

## 10. Realtime spine (summary of the contract)

- Envelope: `{type, entity, entity_id, ts, payload}` — e.g.
  `order.status_changed`, `message.created`, `inventory.low_stock`.
- Channels: `user:{id}` · `role:{sales|manager|admin|hr}` · `conv:{id}` ·
  `topic:{catalogue|inventory|kpi}`. Channel authorization enforced at
  subscribe time from the JWT.
- Clients refetch-on-reconnect; events carry ids, not full objects, so a
  missed event is only ever a stale cache, never wrong data.

## 11. Background jobs (arq registry)

`send_sms` · `process_razorpay_webhook` · `generate_invoice_pdf` ·
`generate_payslip_pdf` · `run_payroll` · `import_catalogue_csv` ·
`refresh_rollups` (nightly) · `low_stock_scan` · `cleanup` (expired OTPs,
stale anon carts, expired sessions, dangling uploads).

## 12. Security & production checklist (gate before launch)

- [ ] Placeholder secret boot-fail; all secrets in Render env, none in git
- [ ] Rate limits + lockouts on OTP/login/webhook/chat
- [ ] Permission checks on every staff route (test asserts the matrix)
- [ ] Webhook HMAC verification + idempotent processing
- [ ] KYC bucket private, presigned URLs short-lived; public bucket images only
- [ ] Audit log covers every staff mutation (test-enforced)
- [ ] Secure cookies, strict CORS (exact Pages origins), HTTPS only
- [ ] Sentry + OTEL traces + `/metrics`; slow-query logging
- [ ] `pip-audit`/`npm audit` in CI; Postgres PITR backups + restore drill
- [ ] Load test: checkout path + 1k concurrent WS clients

## 13. Testing strategy

- Unit: services (pricing, stock reservation, leave balances, payroll math).
- API: per-domain integration tests against the test DB (existing pattern in
  `tests/`), including the **permission matrix** (each role × each staff
  endpoint) and webhook idempotency.
- WS: connect/authorize/receive tests per channel type.
- Contract: CI regenerates the TS client from OpenAPI and fails on drift.
- CI already greps app code for mock markers — keep it green.

## 14. Build order & sizing

| # | Workstream | Depends on | Size |
|---|---|---|---|
| B0 | Foundation: config, phone/OTP identity, RBAC enforcement, rate limits, arq, WS skeleton | — | L (~1.5–2 wks) |
| B1 | KYC & verifications | B0 | M (~1 wk) |
| B2 | Admin catalogue CRUD + CSV import + CMS/settings | B0 | L (~1.5 wks) |
| B3 | Inventory ledger + atomic reservation | B2 | M (~1 wk) |
| B4 | Razorpay live + invoices + shipments | B3 | M (~1 wk) |
| B5 | Enquiries + chat + notifications | B0 (WS) | L (~1.5 wks) |
| B6 | Sales org + analytics/rollups + audit viewer | B4 | M (~1 wk) |
| B7 | HR suite | B0 | L (~1.5 wks) |

B1/B2 can run in parallel after B0; B5 and B7 are independent of the
commerce chain (B2→B3→B4→B6). Sizes assume one engineer + AI pairing;
frontend wiring per domain lands right behind each workstream.
