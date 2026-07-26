# Product Detail Page — Full Content Build

*Plan prepared 2026-07-21 against the SKM Siddha reference page. Awaiting approval — no code written yet.*

---

## 1. Reference decomposition

The example page carries 14 distinct blocks:

| # | Block | Example content |
|---|---|---|
| 1 | Title + pack | ADATHODAI MANAPPAGU — 150GMS |
| 2 | Live stock | In Stock (29) |
| 3 | Price + tax note | ₹200 (Incl. of all taxes) |
| 4 | Benefit highlights | 4 bullet claims |
| 5 | Qty + Add to cart | stepper + CTA |
| 6 | Offer strip | Free shipping above ₹499 |
| 7 | Attribute table | Category, Sub-category, Relieves, Country of origin, Contact, SKU, Stock, Manufacturer/marketer + address |
| 8 | Trust badges | Cruelty-free · Safe herbs · Preservative-free · GMP facility |
| 9 | Tags | ADATHODAI MANAPPAGU, MANAPPAGU |
| 10 | Description | prose |
| 11 | Ingredients | table: name · botanical name · proportion |
| 12 | Indications | prose |
| 13 | Doses | usage instructions |
| 14 | Reviews / FAQs / Related | with auth-gated write actions |

## 2. What already exists vs. what's missing

**Already in the platform (UI work only):**
- Title, brand, pack size (`ProductVariant.pack_size`), category + `sub_category`
- Price with role tiers, MRP, `hsn_code`, `gst_rate_pct`
- `description`, `specs` (JSONB), `attributes` (JSONB), `badge`
- Image gallery — `product_images` exists with `is_primary`/`sort_order`; the PDP renders **one** image today
- **Reviews are fully built server-side and completely unused by the UI**: `reviews` table (one per user+product, `is_verified_purchase`, DB trigger maintaining `products.rating`/`reviews_count`) and endpoints `GET /products/{slug}/reviews`, `POST /products/{slug}/reviews`. This is the single biggest quick win.
- Free-shipping threshold already lives in `services/pricing.py`

**Missing — needs backend work:**
- Live stock **count** (StockLevel has `on_hand`/`reserved`; never exposed publicly)
- Benefit highlights, ingredients, indications, dosage
- Manufacturer / marketer name + address, consumer-care contact, country of origin
- Certifications (GMP, cruelty-free…), tags
- Product FAQs (table + ask/moderate flow)
- Related products (query only, no schema)

## 3. ⚠️ Pricing display — decision required before build

The reference shows **"₹200 (Incl. of all taxes)"**. Our pricing is the opposite:
`compute_line()` does `line_total = subtotal + gst_amount` — **GST is added on top of
`selling_price`**, so stored prices are tax-*exclusive*.

Printing "incl. of all taxes" over a price that later grows by 12% at checkout would
be misleading, and under Legal Metrology / consumer-protection rules an e-commerce
listing must show the final MRP inclusive of taxes. **Two honest options:**

- **A — Prices become tax-inclusive (recommended, matches Indian retail).** Store MRP
  inclusive; back-calculate GST at line level (`gst = round(price × rate / (100+rate))`).
  Cart total then equals price × qty with no surprise. Requires a pricing change,
  a data migration of existing prices, and updates to invoice maths + tests.
- **B — Keep exclusive and label honestly.** Show "₹200 + GST" and an inclusive figure
  beside it. No migration; least risk; less familiar to Indian retail buyers.

Doing neither — showing exclusive prices labelled "inclusive" — is not an option.

## 4. Data model (migration 0012)

**New columns on `products`:**
| Column | Type | Purpose |
|---|---|---|
| `highlights` | JSONB `list[str]` | Benefit bullets |
| `indications` | Text | "Helps relieve…" prose |
| `dosage` | Text | Usage/directions |
| `ingredients` | JSONB `list[{name, botanical, proportion}]` | Composition table |
| `country_of_origin` | String(60) | Legal Metrology requirement |
| `shelf_life_months` | SmallInt, null | Optional |
| `manufacturer_id` | FK → `manufacturers` | Compliance block |

Rationale: highlights/ingredients are document-shaped content read as a whole and never
queried field-by-field → JSONB. Manufacturer is shared across many products and is
compliance-critical → its own table so one edit corrects every listing.

**New tables:**
- `manufacturers` — name, address, licence_no, support_phone, support_email
- `certifications` — code (unique), label, description, icon
- `product_certifications` — join, unique (product_id, certification_id)
- `tags` — slug (unique), label
- `product_tags` — join, unique (product_id, tag_id), indexed for related-product lookups
- `product_faqs` — product_id, question, answer, asked_by_user_id, answered_by_user_id,
  status enum (`pending`/`published`/`rejected`), created_at, answered_at.
  Indexed on (product_id, status).

All with the platform's standard audit columns and FK cascade rules.

## 5. API changes

- `ProductDetail` gains: highlights, ingredients, indications, dosage, country_of_origin,
  manufacturer block, certifications[], tags[], `available_qty`, `sku`
- `GET /products/{slug}/related` — same sub-category → category fallback, in-stock first, limit 8
- `GET /products/{slug}/faqs` — published only
- `POST /products/{slug}/faqs` — authenticated ask, lands as `pending`
- `GET /products/{slug}/reviews` — **exists**; extend response with a rating
  distribution (5→1 counts) for the summary bars
- Admin: `/admin/products/{id}/content`, `/admin/manufacturers`, `/admin/certifications`,
  `/admin/faqs` (moderation queue) — all behind `catalogue:write` except FAQ answering

## 6. Frontend — PDP structure

Two-column above the fold (gallery | buy box), full-width content below:

- **Gallery**: thumbnail rail + main image, zoom on hover, keyboard navigable
- **Buy box**: title, brand, pack-size variant chips, price + tax note, stock line with
  count, highlights bullets, qty stepper + Add to cart (reusing the existing stepper),
  save/compare, offer strip, delivery/Rx pills
- **Compliance table**: the attribute grid (category, origin, SKU, manufacturer, contact…)
- **Trust badges**: certification row driven by real data, not hardcoded
- **Content tabs** (anchored sections, not JS-only tabs so they stay linkable/SEO-visible):
  Description · Ingredients · Indications · Doses
- **Reviews**: average + distribution bars, verified-purchase badges, write form (auth-gated)
- **FAQs**: published Q&A, "Ask a question" (auth-gated)
- **Related products**: reuses the existing `ProductCard` + rail

## 7. Admin surfaces (otherwise none of this is fillable)

Content without an editor is dead weight, so this is in scope, not optional:
- Product content drawer: highlights repeater, ingredients repeater, indications/dosage,
  origin, manufacturer picker, certification multi-select, tag input
- Manufacturers CRUD · Certifications CRUD (seeded with the common four)
- FAQ moderation queue: answer, publish, reject
- Image manager for the gallery (upload/reorder/set primary)

## 8. Phases

| Phase | Scope |
|---|---|
| **P1** | Migration 0012, models, services, admin + public endpoints, seed content for demo products, backend tests |
| **P2** | PDP rebuild: gallery, buy box, compliance table, badges, content sections |
| **P3** | Reviews UI (summary, list, write form) — mostly wiring existing API |
| **P4** | FAQ UI + ask flow |
| **P5** | Related products |
| **P6** | Admin surfaces for all new content |
| **P7** | Verify: pytest, type regen, browser QA at 3 widths, docs |

## 9. Owner decisions — received 2026-07-21

**② Stock — banded, no exact counts.** Public PDP shows `In stock` /
`Only a few left` / `Out of stock`. The threshold is a setting; exact `on_hand`
stays staff-only in the dashboard. *(Better call than the reference page — exact
counts hand competitors your inventory.)*

**③ FAQs customer-submitted + moderated, and reviews get a moderation queue with
a reward.** Two consequences worth naming:
- Reviews currently publish instantly, and the DB trigger `reviews_recompute_aiud`
  recomputes `products.rating` on every insert. With moderation the trigger **must
  count approved reviews only**, or pending/rejected ones will inflate the rating.
  Migration 0012 rewrites the trigger's WHERE clause.
- "Discount for each review" needs **per-user coupons**, which don't exist —
  `coupons` is a global code with `max_uses` and no `user_id`. Add
  `review_rewards` (review_id, user_id, coupon_id, granted_at) plus a nullable
  `coupons.user_id` so a granted code is only redeemable by its owner. Reward
  size is configurable in `app_settings`, not hardcoded.

**④ Certifications belong to the manufacturer, not the product.** Dropping
`product_certifications`; join becomes `manufacturer_certifications`. The PDP
renders the badges of the product's manufacturer. Editing GMP status once fixes
every product from that maker — the right normalization.

**① Pricing — needs one confirmation, see §10.**

## 10. Pricing — what the data already says

Two findings from the live database:

**a) `price_max` is not a range — it's the MRP.** The card "₹85 – ₹100" is
selling-price vs MRP (a strike-through discount), mislabelled as a range in
`_serialize_product`.

**b) A genuine per-role range already exists, across pack sizes.** Amoxicillin,
retailer tier:

| Pack | Retailer price |
|---|---|
| 10x10 strip | ₹69 |
| Box of 100 | ₹620 |

So "starting and ending, like 25–40" is already expressible — the range is
**min→max selling price across a product's pack sizes, for the viewer's role**.
No new schema needed; the serializer is simply wrong today.

**Recommended model:**
- **Listing / home:** show the role's range (or average, as asked) — e.g. "₹69 – ₹620"
- **PDP:** show the range *and* the exact price of the selected pack, with the
  role tier named ("retailer pricing")
- **Checkout:** always charges the selected variant's exact price — a range can
  never be charged, so this keeps money unambiguous
- **Negotiated pricing** (a genuinely variable band per buyer) already has a home:
  the existing **enquiry / RFQ quote flow**. That's where haggling belongs, not
  on the catalogue price.
- **Admin:** the price editor manages price-per-variant-per-role; the range is
  derived, never typed twice

**Still unanswered — tax display (§3).** Prices today are GST-**exclusive**
(`line_total = subtotal + gst`). Confirm **A** (make them tax-inclusive, Indian
retail norm, needs a data migration) or **B** (keep exclusive, label "+ GST").

## 11. Superseded — original open questions

1. **Pricing display — option A (tax-inclusive, migration) or B (exclusive, labelled)?** ← blocks P1
2. **Show exact stock count publicly** ("In Stock (29)") or just a status band
   ("In stock" / "Only a few left")? Exact counts reveal inventory to competitors.
3. **Tags** — normalized tables (proposed) or a simpler JSONB array + GIN index?
4. **FAQs** — allow customer-submitted questions with moderation (proposed), or
   admin-authored only?
5. **Reviews** — currently publish instantly. Add moderation, or restrict to
   verified purchasers?
6. **Certifications** — per product (proposed) or inherited from manufacturer?
