"use client";

import type { ProductDetail } from "@nethrasap/api-client";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { inr } from "@/lib/format";
import { SITE_TEXT } from "@/lib/content";
import { useSaved } from "@/lib/saved";

type VariantOut = ProductDetail["variants"][number];
/* `available_units` lands with the parallel backend change (null/absent =
   untracked → fall back to product-level stock_status). Typed structurally
   until the generated schema catches up. */
type Variant = VariantOut & { available_units?: number | null };
type Price = NonNullable<VariantOut["prices"]>[number];

/** Price row for the viewer's tier (falls back to the customer tier). */
function priceForRole(variant: Variant | undefined, role: string | undefined): Price | null {
  const prices = variant?.prices ?? [];
  return prices.find((p) => p.role === role) ?? prices.find((p) => p.role === "customer") ?? prices[0] ?? null;
}

function AddOrStep({ variantId, disabled, large, quote, label }: {
  variantId: string; disabled: boolean; large?: boolean; quote?: boolean; label?: string;
}) {
  const { qtyForVariant, incVariant, decVariant } = useCart();
  const qty = qtyForVariant(variantId);
  if (qty === 0) {
    return (
      <button type="button" className={large ? "btn btn-primary grow btn-lg" : "add-btn"} disabled={disabled}
        onClick={() => incVariant(variantId)}>
        {disabled ? "Out of stock" : quote ? "Add to quote request" : label ?? "Add to cart"}
      </button>
    );
  }
  return (
    <span className={`stepper ${large ? "lg" : ""}`}>
      <button type="button" aria-label="Decrease quantity" onClick={() => decVariant(variantId)}>−</button>
      <b>{qty}</b>
      <button type="button" aria-label="Increase quantity" onClick={() => incVariant(variantId)}>+</button>
    </span>
  );
}

/** Banded fallback when a variant doesn't track exact units (owner decision,
 *  2026-07-21 — banded copy stays for untracked stock). */
function StockBand({ status }: { status: string }) {
  if (status === "out_of_stock") return <span className="pill pill-muted">Out of stock</span>;
  if (status === "low_stock") return <span className="pill pill-low">Only a few left</span>;
  if (status === "discontinued") return <span className="pill pill-muted">Discontinued</span>;
  return <span className="pill pill-ok">In stock</span>;
}

/** Exact-count pill per the approved mockup. `units` null = untracked. */
function StockPill({ units, status }: { units: number | null; status: string }) {
  if (status === "discontinued") return <span className="pill pill-muted">Discontinued</span>;
  if (units == null) return <StockBand status={status} />;
  if (units <= 0) return <span className="pill pill-muted">Out of stock</span>;
  if (units <= 5) return <span className="pill pill-low">Only {units} left</span>;
  return <span className="pill pill-ok">● In stock — {units} units</span>;
}

export function BuyBox({
  product,
  shippingText = SITE_TEXT.buybox_shipping,
  taxText = SITE_TEXT.buybox_tax,
}: {
  product: ProductDetail;
  shippingText?: string;
  taxText?: string;
}) {
  const { user } = useAuth();
  const { isSaved, isCompared, toggleSaved, toggleCompared } = useSaved();
  const variants = product.variants as Variant[];
  const [variantId, setVariantId] = useState(
    variants.find((v) => v.is_default)?.id ?? variants[0]?.id ?? "",
  );

  const variant = variants.find((v) => v.id === variantId);
  const price = priceForRole(variant, user?.role);
  const discontinued = product.stock_status === "discontinued";
  const units = variant?.available_units ?? null;
  const outOfStock = units != null ? units <= 0 : product.stock_status === "out_of_stock";
  // Quote-vs-buy is decided per the VIEWER's own role price on the selected pack:
  // a role priced as an indicative band is quote-only, while another role on the
  // same product can stay a fixed Add-to-cart price (e.g. customer fixed,
  // retailer range). is_quote_only from the API is only the anonymous default.
  const range = price && price.range_min != null && price.range_max != null && price.range_max > price.range_min
    ? { min: price.range_min, max: price.range_max }
    : null;
  const quote = range != null;
  // For a fixed product with multiple packs, price_min→max is a pack band.
  const hasPackBand = !quote && product.variants.length > 1 && product.price_max > product.price_min;
  const savings = !quote && price && price.mrp > price.selling_price ? price.mrp - price.selling_price : 0;
  const offPct = savings > 0 && price ? Math.round((savings / price.mrp) * 100) : 0;

  // Trade-tier hint: anonymous/customer viewers see the wholesale band when a
  // retailer/clinician price row exists on the selected variant.
  const tradeRows = (variant?.prices ?? []).filter((p) => p.role === "retailer" || p.role === "clinician");
  const tradeMin = tradeRows.length
    ? Math.min(...tradeRows.map((p) => p.range_min ?? p.selling_price))
    : null;
  const tradeMax = tradeRows.length
    ? Math.max(...tradeRows.map((p) => p.range_max ?? p.selling_price))
    : null;
  const showRoleHint = !quote && (!user || user.role === "customer") && tradeMin != null && tradeMax != null;

  return (
    <>
      <div className="buybox">
        <div className="stockline">
          <StockPill units={units} status={product.stock_status} />
        </div>

        {quote ? (
          <>
            <span className="pill pill-info" style={{ marginBottom: 10 }}>Quote-based pricing</span>
            <div className="buy-price">
              <span className="amount">
                {range ? `${inr(range.min)} – ${inr(range.max)}` : inr(price?.selling_price)}
              </span>
            </div>
            <p className="buy-tax small muted">
              Indicative range{user && user.role !== "customer" && <> · {user.role} tier</>}. Your firm price is
              confirmed on the quote.
            </p>
          </>
        ) : (
          <>
            {hasPackBand && (
              <p className="buy-band small muted">
                {product.variants.length} pack sizes · {inr(product.price_min)} – {inr(product.price_max)}
              </p>
            )}
            <div className="buy-price">
              <span className="amount">{inr(price?.selling_price)}</span>
              {savings > 0 && <span className="mrp">MRP {inr(price?.mrp)}</span>}
              {offPct > 0 && <span className="off-pct">{offPct}% off</span>}
            </div>
            <p className="buy-tax small muted">{taxText}</p>
          </>
        )}

        {showRoleHint && (
          <p className="rolehint">
            Retailers &amp; clinicians: wholesale rate{" "}
            <b>{tradeMin === tradeMax ? inr(tradeMin) : `${inr(tradeMin)} – ${inr(tradeMax)}`}</b> after KYC —{" "}
            <Link href="/account">complete verification</Link>
          </p>
        )}

        {product.variants.length > 1 && (
          <div className="field" style={{ margin: "16px 0 0" }}>
            <label>Pack size</label>
            <div className="pack-picker">
              {variants.map((v) => {
                const p = priceForRole(v, user?.role);
                const vr = p && p.range_min != null && p.range_max != null;
                return (
                  <button key={v.id} type="button" className={`pack-opt ${v.id === variantId ? "on" : ""}`}
                    onClick={() => setVariantId(v.id)} aria-pressed={v.id === variantId}>
                    <b>{v.pack_size}</b>
                    <span className="mono">
                      {vr ? `${inr(p!.range_min)}–${inr(p!.range_max)}` : inr(p?.selling_price)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {product.description && (
          <p className="buy-desc">{product.description}</p>
        )}

        {/* Discontinued products keep the page for SEO but lose the buy row. */}
        {discontinued ? (
          <p className="small muted" style={{ marginTop: 16 }}>
            This product has been discontinued and can no longer be ordered.
          </p>
        ) : (
          <>
            <div className="row" style={{ gap: 10, marginTop: 16 }}>
              {variantId && (
                <AddOrStep variantId={variantId} disabled={outOfStock || !variant} large quote={quote}
                  label={price ? `Add to cart — ${inr(price.selling_price)}` : undefined} />
              )}
              {!quote && (
                <Link href="/cart" className="btn btn-outline">
                  Get bulk quote
                </Link>
              )}
            </div>
            {quote && (
              <p className="small muted" style={{ margin: "8px 0 0" }}>
                Add packs to your request — a sales rep sends a firm quote you can accept or negotiate.
              </p>
            )}
          </>
        )}

        <div className="row" style={{ gap: 10, marginTop: 10 }}>
          <button type="button" className="btn btn-outline btn-sm grow" aria-pressed={isSaved(product.id)}
            onClick={() => toggleSaved(product.id)}>
            {isSaved(product.id) ? "♥ Saved" : "♡ Save for later"}
          </button>
          <button type="button" className="btn btn-outline btn-sm grow" aria-pressed={isCompared(product.id)}
            onClick={() => toggleCompared(product.id)}>
            {isCompared(product.id) ? "✓ In compare" : "⇄ Compare"}
          </button>
        </div>

        <div className="offer-strip">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 8h13v8H1zM14 11h4l3 3v2h-7z" />
            <circle cx="6" cy="18" r="1.8" />
            <circle cx="17" cy="18" r="1.8" />
          </svg>
          <span>{shippingText}</span>
        </div>

        {product.schedule && product.schedule !== "NONE" && (
          <p className="buy-rx small">
            Schedule {product.schedule} drug — a valid prescription is required at delivery.
          </p>
        )}
      </div>

      {/* Sticky mobile buy bar */}
      {!discontinued && (
        <div className="buybar">
          <div>
            <div className="mono" style={{ fontWeight: 700, fontSize: "1.05rem" }}>
              {quote && range ? `${inr(range.min)}–${inr(range.max)}` : inr(price?.selling_price)}
            </div>
            <div className="small muted" style={{ lineHeight: 1.2 }}>
              {variant?.pack_size} · {quote ? "quote-based" : "incl. taxes"}
            </div>
          </div>
          {variantId && <AddOrStep variantId={variantId} disabled={outOfStock || !variant} large quote={quote} />}
        </div>
      )}
    </>
  );
}

export { StockBand };
