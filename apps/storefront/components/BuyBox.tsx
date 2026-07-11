"use client";

import type { ProductDetail } from "@nethrasap/api-client";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { inr } from "@/lib/format";

// Pick the price for the viewer's role (falls back to customer).
function priceForRole(variant: ProductDetail["variants"][number], role: string | undefined) {
  const prices = variant.prices ?? [];
  const match =
    prices.find((p) => p.role === role) ?? prices.find((p) => p.role === "customer") ?? prices[0];
  return match?.selling_price ?? null;
}

export function BuyBox({ product }: { product: ProductDetail }) {
  const { user } = useAuth();
  const { add } = useCart();
  const [variantId, setVariantId] = useState(
    product.variants.find((v) => v.is_default)?.id ?? product.variants[0]?.id ?? "",
  );
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);

  const variant = product.variants.find((v) => v.id === variantId);
  const price = variant ? priceForRole(variant, user?.role) : null;
  const outOfStock = product.stock_status === "out_of_stock";

  return (
    <div className="card pad" style={{ display: "grid", gap: 14 }}>
      {product.variants.length > 1 && (
        <div className="field" style={{ margin: 0 }}>
          <label>Pack size</label>
          <select className="input" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
            {product.variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.pack_size} — {inr(priceForRole(v, user?.role))}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="row spread">
        <div className="price" style={{ fontSize: "1.6rem" }}>
          {inr(price)}
        </div>
        {user && user.role !== "customer" && (
          <span className="pill pill-ok">{user.role} pricing</span>
        )}
      </div>

      <div className="row" style={{ gap: 10 }}>
        <div className="row" style={{ border: "1px solid var(--line)", borderRadius: 10 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setQty((q) => Math.max(1, q - 1))}>
            −
          </button>
          <span style={{ minWidth: 28, textAlign: "center" }}>{qty}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setQty((q) => q + 1)}>
            +
          </button>
        </div>
        <button
          className="btn btn-primary grow"
          disabled={busy || outOfStock || !variant}
          onClick={async () => {
            setBusy(true);
            await add(variantId, qty);
            setBusy(false);
          }}
        >
          {outOfStock ? "Out of stock" : "Add to cart"}
        </button>
      </div>

      {product.schedule && product.schedule !== "NONE" && (
        <div className="small muted">
          Schedule {product.schedule} drug — a valid prescription is required at delivery.
        </div>
      )}
    </div>
  );
}
