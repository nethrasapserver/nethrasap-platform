"use client";

import type { ProductDetail } from "@nethrasap/api-client";
import { useState } from "react";

/* Mockup layout (docs/mockups/pdp-sample.html): one square main stage plus a
   fixed row of three thumbnail tiles. Primary image first, then sort_order;
   empty slots render as bordered white placeholder tiles so the grid never
   collapses. */
const THUMB_SLOTS = 3;

function PlaceholderArt({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
      <path d="M4 7h16M6 7v12a2 2 0 002 2h8a2 2 0 002-2V7M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
    </svg>
  );
}

export function ProductGallery({ product }: { product: ProductDetail }) {
  const images = [...(product.images ?? [])]
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)
    .slice(0, THUMB_SLOTS);
  const [active, setActive] = useState(0);
  const current = images[active];

  return (
    <div className="gallery">
      <div className="gallery-main">
        {product.badge && <span className="g-badge">{product.badge}</span>}
        {current ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={current.storage_key} alt={current.alt ?? product.name} />
        ) : (
          <PlaceholderArt />
        )}
      </div>

      <div className="g-thumbs" role="tablist" aria-label="Product images">
        {Array.from({ length: THUMB_SLOTS }, (_, i) => {
          const img = images[i];
          if (!img) {
            return (
              <span key={`empty-${i}`} className="g-thumb is-empty" aria-hidden="true">
                <PlaceholderArt size={34} />
              </span>
            );
          }
          return (
            <button
              key={img.storage_key}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`View image ${i + 1}`}
              className={`g-thumb ${i === active ? "on" : ""}`}
              onClick={() => setActive(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.storage_key} alt="" loading="lazy" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
