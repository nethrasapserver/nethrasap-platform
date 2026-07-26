"use client";

import type { ProductListItem } from "@nethrasap/api-client";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { inr, inrAvg } from "@/lib/format";
import { useSaved } from "@/lib/saved";

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 21s-7.5-4.6-9.9-9A5.6 5.6 0 0112 6.3 5.6 5.6 0 0121.9 12c-2.4 4.4-9.9 9-9.9 9z" />
    </svg>
  );
}
function CompareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M8 3L4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4" />
    </svg>
  );
}

/** Blinkit-style card: ADD morphs into a − qty + stepper wired to the live cart. */
function CardAdd({ p }: { p: ProductListItem }) {
  const { qtyForVariant, incVariant, decVariant } = useCart();
  const vid = p.default_variant_id;
  const out = p.stock_status === "out_of_stock";
  if (!vid || out) {
    return (
      <button type="button" className="add-btn" disabled>
        {out ? "SOLD OUT" : "VIEW"}
      </button>
    );
  }
  const qty = qtyForVariant(vid);
  if (qty === 0) {
    return (
      <button
        type="button"
        className="add-btn"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          incVariant(vid);
        }}
      >
        ADD
      </button>
    );
  }
  return (
    <span className="stepper" onClick={(e) => e.preventDefault()}>
      <button type="button" aria-label="Decrease quantity" onClick={(e) => { e.preventDefault(); e.stopPropagation(); decVariant(vid); }}>
        −
      </button>
      <b>{qty}</b>
      <button type="button" aria-label="Increase quantity" onClick={(e) => { e.preventDefault(); e.stopPropagation(); incVariant(vid); }}>
        +
      </button>
    </span>
  );
}

export function ProductCard({ p }: { p: ProductListItem }) {
  const { isSaved, isCompared, toggleSaved, toggleCompared } = useSaved();
  const saved = isSaved(p.id);
  const compared = isCompared(p.id);
  const out = p.stock_status === "out_of_stock";
  const low = p.stock_status === "low_stock";
  const rx = p.schedule && p.schedule !== "NONE";
  const quote = p.is_quote_only;
  // Strike-through only makes sense for a fixed price below its MRP.
  const hasDiscount = !quote && p.mrp > 0 && p.mrp > p.price_min;

  return (
    <Link href={`/products/${p.slug}`} className="pcard">
      <div className="card-acts">
        <button
          type="button"
          className={`card-act ${saved ? "on" : ""}`}
          aria-label={saved ? "Remove from saved items" : "Save for later"}
          aria-pressed={saved}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSaved(p.id); }}
        >
          <HeartIcon filled={saved} />
        </button>
        <button
          type="button"
          className={`card-act ${compared ? "on" : ""}`}
          aria-label={compared ? "Remove from compare" : "Add to compare"}
          aria-pressed={compared}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleCompared(p.id); }}
        >
          <CompareIcon />
        </button>
      </div>

      <div className="thumb">
        {(low || rx) && (
          <div className="pbadges">
            {low && <span className="pill pill-low">Low stock</span>}
            {rx && <span className="pill pill-rx">Rx · {p.schedule}</span>}
          </div>
        )}
        {p.image_key ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={p.image_key} alt={p.name} loading="lazy" className="thumb-img" />
        ) : (
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
            <path d="M4 7h16M6 7v12a2 2 0 002 2h8a2 2 0 002-2V7M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
          </svg>
        )}
        {out && (
          <span className="out-scrim">
            <span className="pill pill-out">Out of stock</span>
          </span>
        )}
      </div>

      <div className="body">
        <div className="brand">{p.unit_label || p.category_name}</div>
        <div className="name">{p.name}</div>
        <div className="pfoot">
          {quote ? (
            <div>
              <span className="price">{inrAvg(p.price_min, p.price_max)}</span>
            </div>
          ) : (
            <div>
              <span className="price">{inr(p.price_min)}</span>
              {hasDiscount && <span className="mrp">{inr(p.mrp)}</span>}
            </div>
          )}
          {quote ? (
            <span className="add-btn quote-chip" aria-hidden="true">Get quote →</span>
          ) : (
            <CardAdd p={p} />
          )}
        </div>
      </div>
    </Link>
  );
}
