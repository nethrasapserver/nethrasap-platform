"use client";

import type { ProductDetail } from "@nethrasap/api-client";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { inr } from "@/lib/format";
import { useSaved } from "@/lib/saved";

type Variant = ProductDetail["variants"][number];
type Price = NonNullable<Variant["prices"]>[number];

/** Price row for the viewer's tier (falls back to the customer tier). */
function priceForRole(variant: Variant | undefined, role: string | undefined): Price | null {
  const prices = variant?.prices ?? [];
  return prices.find((p) => p.role === role) ?? prices.find((p) => p.role === "customer") ?? prices[0] ?? null;
}

function AddOrStep({ variantId, disabled, large, quote }: { variantId: string; disabled: boolean; large?: boolean; quote?: boolean }) {
  const { qtyForVariant, incVariant, decVariant } = useCart();
  const qty = qtyForVariant(variantId);
  if (qty === 0) {
    return (
      <button type="button" className={large ? "btn btn-primary grow btn-lg" : "add-btn"} disabled={disabled}
        onClick={() => incVariant(variantId)}>
        {disabled ? "Out of stock" : quote ? "Add to quote request" : "Add to cart"}
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

/** Stock is banded, never an exact count — an exact number tells competitors
 *  what we hold. (Owner decision, 2026-07-21.) */
function StockBand({ status }: { status: string }) {
  if (status === "out_of_stock") return <span className="pill pill-out">Out of stock</span>;
  if (status === "low_stock") return <span className="pill pill-low">Only a few left</span>;
  if (status === "discontinued") return <span className="pill pill-out">Discontinued</span>;
  return <span className="pill pill-ok">In stock</span>;
}

export function BuyBox({ product }: { product: ProductDetail }) {
  const { user } = useAuth();
  const { isSaved, isCompared, toggleSaved, toggleCompared } = useSaved();
  const [variantId, setVariantId] = useState(
    product.variants.find((v) => v.is_default)?.id ?? product.variants[0]?.id ?? "",
  );

  const variant = product.variants.find((v) => v.id === variantId);
  const price = priceForRole(variant, user?.role);
  const outOfStock = product.stock_status === "out_of_stock";
  const quote = product.is_quote_only;
  // For a fixed product with multiple packs, price_min→max is a pack band.
  const hasPackBand = !quote && product.variants.length > 1 && product.price_max > product.price_min;
  const savings = !quote && price && price.mrp > price.selling_price ? price.mrp - price.selling_price : 0;
  const range = price && price.range_min != null && price.range_max != null
    ? { min: price.range_min, max: price.range_max }
    : null;

  return (
    <>
      <div className="buybox">
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
              {savings > 0 && <span className="mrp">{inr(price?.mrp)}</span>}
              {savings > 0 && <span className="pill pill-ok">Save {inr(savings)}</span>}
            </div>
            <p className="buy-tax small muted">
              Inclusive of all taxes
              {price && price.gst_amount > 0 && <> · includes {inr(price.gst_amount)} GST @ {price.gst_rate_pct}%</>}
            </p>
          </>
        )}

        {product.variants.length > 1 && (
          <div className="field" style={{ margin: "16px 0 0" }}>
            <label>Pack size</label>
            <div className="pack-picker">
              {product.variants.map((v) => {
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

        <div className="row" style={{ gap: 10, marginTop: 16 }}>
          {variantId && <AddOrStep variantId={variantId} disabled={outOfStock || !variant} large quote={quote} />}
        </div>
        {quote && (
          <p className="small muted" style={{ margin: "8px 0 0" }}>
            Add packs to your request — a sales rep sends a firm quote you can accept or negotiate.
          </p>
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

        <ul className="buy-perks">
          <li>Free delivery on orders above ₹500</li>
          <li>{product.delivery_time_mins ?? 90}-minute delivery in serviceable pincodes</li>
          {user && user.role !== "customer" && <li>{user.role} pricing applied to your account</li>}
        </ul>

        {product.schedule && product.schedule !== "NONE" && (
          <p className="buy-rx small">
            Schedule {product.schedule} drug — a valid prescription is required at delivery.
          </p>
        )}
      </div>

      {/* Sticky mobile buy bar */}
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
    </>
  );
}

export { StockBand };
