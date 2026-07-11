# B3 (Inventory) + B4 (Payments & Fulfillment) — Execution Plan

Follows [backend-plan.md](backend-plan.md); written against the code as of
commit `c7e4332` (B0–B2 complete, 84 tests green).

## B3 — Inventory ledger & atomic reservation

**Goal:** stock becomes a real, auditable quantity. Oversell becomes
impossible by construction; `products.stock_status` becomes derived.

### Migration 0007
| Table | Columns (key ones) |
|---|---|
| `warehouses` | code (unique), name, city/state/pincode, is_active. Migration inserts a default `MAIN` warehouse. |
| `stock_levels` | variant_id + warehouse_id (unique pair), on_hand ≥ 0, reserved ≥ 0, reorder_point. `available = on_hand − reserved` computed in queries. |
| `stock_ledger` | append-only: variant, warehouse, movement (`receipt/reservation/release/fulfillment/adjustment/return`), signed qty, actor, ref_type/ref_id (order, etc.), note, created_at. |

Deviation from the original sketch: no separate `stock_adjustments` table —
an adjustment is a ledger row with a reason + the audit_log entry. One source
of truth, less drift.

### Tracked vs untracked policy
A variant with **no stock_levels row is untracked** (checkout doesn't gate on
it; `stock_status` stays admin-set). The first `receive` creates the row and
flips the variant to tracked/enforced. This lets the existing catalogue keep
selling while stock gets onboarded gradually.

### Service (`services/inventory.py`)
- `receive_stock`, `adjust_stock` (delta, reason; guard ≥ 0) → ledger rows
- `reserve_for_order(order)` — inside the checkout transaction:
  `SELECT … FOR UPDATE` on stock_levels **ordered by variant_id** (deadlock-
  safe), check `available ≥ qty` else 409 `insufficient stock for <name>`,
  `reserved += qty`, ledger(reservation, ref=order)
- `release_for_order` (cancel / payment failure) and `fulfil_for_order`
  (dispatch: `on_hand −= qty, reserved −= qty`)
- After every mutation: recompute derived `products.stock_status`
  (0 available → out_of_stock, ≤ reorder_point → low_stock, else in_stock);
  status flips publish `product.updated` → `topic:catalogue`, low-stock
  crossings publish `inventory.low_stock` → `topic:inventory`

### Endpoints (new `inventory:write` permission; reads with `kyc`-style staff perm)
- `GET /admin/inventory` (levels joined to product/variant, low-stock filter)
- `POST /admin/inventory/receive` · `POST /admin/inventory/adjust`
- `GET /admin/inventory/ledger?variant_id=…`
- `GET/POST /admin/warehouses`

### Checkout integration
`place_order`: reserve after totals, before commit (same transaction as the
order insert). `cancel_order`: release. B4's dispatch: fulfil.

### Acceptance
- Two concurrent checkouts of the last unit: exactly one succeeds.
- `sum(ledger)` reconstructs `on_hand`/`reserved` exactly (test asserts).
- Cancel releases; storefront stock badge flips in realtime.

---

## B4 — Razorpay live, invoices, shipments, refunds

**Goal:** money is real (test keys), every order transition notifies over SMS
+ WebSocket, invoices are downloadable PDFs, staff dispatch drives fulfilment.

### 1. Real gateway (`integrations/razorpay.py`)
- httpx client: `create_order` (amount/INR/receipt/notes), `refund`,
  `fetch_payment` — basic-auth with key_id/secret; deterministic stub retained
  when unconfigured (dev without keys).
- `verify_webhook_signature` (already written) + `verify_checkout_signature`
  (`order_id|payment_id` HMAC) for the client-confirm path.

### 2. Checkout handshake
Non-COD place → real `gateway_order_id` stored on Payment; response carries
`{key_id, order_id, amount}` for the Razorpay JS modal.

### 3. Payment confirmation — two idempotent doors into ONE service function
- `POST /payments/webhook` — raw-body signature check, handles
  `payment.captured` / `payment.failed`. Idempotent on payment status.
- `POST /checkout/confirm` — client-side fallback (signature-verified), same
  transition. Needed for local dev where Razorpay can't reach a webhook.
- Captured: Payment → captured, Order placed → confirmed, SMS, WS events
  (`user:{id}` + `role:sales`), enqueue invoice job.
- Failed: Order → payment_failed, **release reserved stock** (B3).

### 4. Invoices
- On confirm: arq job renders the PDF with **reportlab** (pure-Python — no
  WeasyPrint system deps on Render/macOS), numbering `INV-YYYY-<seq>`,
  uploads to R2 `invoices/` (private).
- `GET /orders/{no}/invoice` → presigned URL (owner or staff).

### 5. Shipments & fulfilment (new `orders:fulfil` permission: sales/manager/admin)
- `POST /admin/orders/{no}/shipment` {courier, awb, eta} → Shipment row,
  order → dispatched, **fulfil stock**, SMS + WS.
- `PATCH /admin/shipments/{id}` status walk (in_transit → out_for_delivery →
  delivered) syncing order status; public `/orders/{no}/track` enriched.
- Every transition appends `order_status_history` (feeds the tracking timeline).

### 6. Refunds (`orders:refund`, admin)
`POST /admin/orders/{no}/refund` {amount?} → gateway refund (real/stub),
Refund row, payment → refunded/partial_refund, full refund ⇒ order refunded,
SMS + WS + audit.

### Order of work & sizing
B3 first (B4's fail/dispatch paths call reserve/release/fulfil):
B3 ≈ 3–4 dev-days equivalent, B4 ≈ 4–5. Both end with the suite green and
migrations applied to Neon.

### Acceptance (B4)
A Razorpay **test-mode** payment completes via webhook → order confirmed +
stock stays reserved → staff dispatch fulfils stock + customer SMS →
delivered walk completes the timeline → invoice PDF downloads via presigned
URL → admin refund round-trips. Without keys, the whole flow still runs on
the stub for local dev/tests.

### Needs from the user (before B4's live half)
- Razorpay account → test-mode `key_id`/`key_secret` (+ webhook secret once a
  public URL exists — that arrives with the Render deploy).
- R2 enablement (invoices bucket shares the KYC credentials).
