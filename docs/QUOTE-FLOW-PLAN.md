# Quote-to-Order Flow — indicative pricing + admin negotiation

*Plan 2026-07-21. The catalogue shows a price **range**; buying is an **enquiry**,
not a direct sale. Admin quotes a firm price; the customer accepts, negotiates,
or requests custom pricing; only then does it become a payable order.*

---

## 1. The model you described

> "checkout is based on the range only… if the customer places an order it's not
> final — it goes like an inquiry, then admin sends the pricing, then the customer
> pays or asks for negotiation / custom pricing."

That is a **request-for-quote (RFQ)** commerce model, standard in pharma wholesale.

## 2. What already exists (unused) — the enquiry system

The backend already implements the entire negotiation lifecycle:

- **Status machine:** `pending → quoted → confirmed → converted` (+ `rejected`)
- **Customer:** `POST /enquiries` (submit), `/messages` (negotiate), `/accept`
- **Admin:** assign · **quote** (sets `quoted_total`, `quote_valid_until`) · reject ·
  **convert** → real order
- Threaded `enquiry_messages` for back-and-forth, full `enquiry_status_history`,
  `converted_order_id` link
- The **dashboard already has an enquiries page + quote drawer** (redesigned earlier)

**What's missing is entirely on the storefront:** there is no customer UI to raise
or track an enquiry today. This is the W4 gap the discovery report flagged.

## 3. Pricing — indicative range, per role, ops-editable

Add to each `product_prices` row (per variant, per role):
- `price_min`, `price_max` — the **indicative band** ops types in
- `selling_price` stays as the reference/anchor but is **not charged directly** —
  the charged figure is whatever admin quotes per enquiry

Display:
- **Home / listing:** average of the role's band → "≈ ₹20"
- **PDP:** the full band → "₹15 – ₹25" with "final price confirmed on quote"
- **Admin price editor:** min/max per variant per role (new dashboard surface)

## 4. The purchase flow (reusing the enquiry engine)

```
Browse → add to a REQUEST LIST (the cart, repurposed)
       → "Request a quote" (was Checkout) → POST /enquiries  [pending]
       → admin prices it in the dashboard quote drawer       [quoted]
       → customer: Accept  ─────────────────────────────────►[confirmed]
                   or Message (negotiate / custom pricing)   [back to thread]
                   or Reject
       → admin Convert → real Order → COD payment            [converted]
```

- The **cart becomes a "quote request list"** — no price totals shown, just items
  + quantities, because the price isn't known until admin quotes.
- **Checkout → "Request a quote"**: address/notes captured, posts to `/enquiries`.
- New storefront **My Enquiries** area: list, detail with the message thread, the
  quoted price when it lands, Accept / Negotiate buttons, and Pay once converted.
- Existing order/track pages stay — they light up after conversion.

## 5. Scope fork — needs your call (§8)

The one thing that changes how much gets rebuilt: **does every purchase become a
quote, or only some products?**

- **Option A — Quote-only storefront.** All buying is RFQ. The direct COD
  checkout I just built is retired (kept in git). Simplest, most coherent, matches
  "if the customer places an order it's not final." Biggest change.
- **Option B — Hybrid.** Fixed-price products (a single price, no range) check out
  directly with COD as today; ranged products go through the quote flow. A product
  is "quote-only" when ops leaves it ranged. More flexible, more surface to
  maintain, two purchase paths to explain to buyers.

## 6. Build phases (either option)

| Phase | Scope |
|---|---|
| **Q1** | Migration 0013: `price_min`/`price_max` on price rows; serializer returns band + average; admin price editor (min/max per role) |
| **Q2** | PDP + cards show the range/average; "final price on quote" messaging |
| **Q3** | Cart → "quote request list"; Checkout → "Request a quote" → `/enquiries` |
| **Q4** | Storefront My Enquiries: list, thread, accept/negotiate, pay-after-convert |
| **Q5** | Realtime: quote-ready notification to customer, new-enquiry to sales (events already exist) |
| **Q6** | Verify: pytest, type regen, full quote→negotiate→convert→pay walkthrough, docs |

## 7. Consequences to note

- **The tax-inclusive pricing work still stands** — the *quoted* price is what
  carries GST at conversion; the range is indicative and untaxed on display.
- **COD-only is unaffected** — payment still happens once, after conversion.
- **The PDP content build (0013: ingredients, FAQs, etc.)** is independent and can
  run alongside or after — say the word on ordering.

## ✅ Built & verified 2026-07-21 (Option B, hybrid)

All phases Q1–Q6 shipped and running on the live stack. Tax display: **A** —
prices tax-inclusive with GST shown (migration 0012); range model layered on top.

- **Q1** migration 0013: `range_min`/`range_max` on `product_prices` (nullable,
  check-constrained). `is_quote_only` derived from the default variant's band at
  the caller's tier. Fixed products untouched → hybrid holds.
- **Q1b** dashboard **price editor** (catalogue → Prices drawer): per variant,
  per role, MRP / selling / range in rupees. Leaving the range blank = fixed
  price; filling it = quote-only. This is how ops set ranges.
- **Q2** cards show ≈average for quote-only; PDP shows the band + "final price on
  quote" and an "Add to quote request" CTA.
- **Q3** cart splits payable vs quote lines, totals exclude quote items;
  checkout **backend-guards** against selling a quote item (can't be charged an
  unquoted price); a checkout with mixed cart sells the fixed lines and leaves
  quote lines for the RFQ.
- **Q4** storefront **/enquiries** (list) + **/enquiries/[id]** (items with
  quoted prices, negotiation thread, accept, pay-after-convert) — wiring the
  enquiry engine that already existed but had no customer UI.
- **Q5** realtime: customer's enquiry list + detail refetch on the WS
  `enquiry.*` events the backend already published; quote-ready notification.
- **Q6** verified: full create→quote→accept→convert→COD cycle on the live stack
  (ENQ-2026-00001 → NS-2026-00001, ₹950); **146 backend tests pass** incl. new
  `test_quote_flow.py` (ranged→quote-only, cart flagging, checkout guard, mixed
  cart, full lifecycle); ruff clean; both frontends build.

## 8. Original decision (now resolved: B)

1. **Option A (quote-only) or B (hybrid)?** ← blocks everything
2. Range stored per **role** (customer/clinician/retailer each get their own
   min–max, as with current pricing) — confirm yes.
3. Home/listing shows the **average** of the band (your earlier call) — confirm.
