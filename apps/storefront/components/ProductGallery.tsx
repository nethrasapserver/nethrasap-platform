"use client";

import type { ProductDetail } from "@nethrasap/api-client";
import { useState } from "react";

/** Main image + thumbnail rail. Product images already existed in the API —
 *  the old PDP only ever rendered the first one. */
export function ProductGallery({ product }: { product: ProductDetail }) {
  const images = [...(product.images ?? [])].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
  );
  const [active, setActive] = useState(0);
  const current = images[active];

  return (
    <div className="gallery">
      <div className="gallery-main">
        {current ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={current.storage_key} alt={current.alt ?? product.name} />
        ) : (
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
            <path d="M4 7h16M6 7v12a2 2 0 002 2h8a2 2 0 002-2V7M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
          </svg>
        )}
      </div>

      {images.length > 1 && (
        <div className="gallery-thumbs" role="tablist" aria-label="Product images">
          {images.map((img, i) => (
            <button
              key={img.storage_key}
              role="tab"
              aria-selected={i === active}
              aria-label={`Image ${i + 1}`}
              className={i === active ? "on" : ""}
              onClick={() => setActive(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.storage_key} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
