"use client";

import type { CategoryItem } from "@nethrasap/api-client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

/* Per-category art. Used when a category has no uploaded `image_key`; the
   moment an admin uploads one, the real image takes over (see below). Keyed by
   slug with a stable fallback so new categories still look intentional. */
const ART: Record<string, { tone: string; icon: string }> = {
  prescription: { tone: "rx", icon: "M10.5 13.5l6 6M4 8a4 4 0 014-4h2v8H8a4 4 0 01-4-4zM10 12l4-4M6 4v16" },
  otc: { tone: "otc", icon: "M12 21a8 8 0 01-8-8c0-4 3-7 8-7s8 3 8 7a8 8 0 01-8 8zM12 6V3M9 3h6" },
  devices: { tone: "dev", icon: "M4 6h10v8H4zM18 9h2v6M14 10h4M6 18h6" },
  diagnostics: { tone: "dev", icon: "M4 6h10v8H4zM18 9h2v6M14 10h4M6 18h6" },
  wellness: { tone: "well", icon: "M12 21s-7-4.3-9-8.4A5.2 5.2 0 0112 6a5.2 5.2 0 019 6.6c-2 4.1-9 8.4-9 8.4z" },
  "cold-chain": { tone: "cold", icon: "M12 3v18M5 7l14 10M19 7L5 17M12 7l-3 3M12 7l3 3M12 17l-3-3M12 17l3-3" },
  surgical: { tone: "surg", icon: "M18 4l2 2-9 9-3 1 1-3zM3 21l6-6M5 13l6 6" },
};
const FALLBACK = { tone: "rx", icon: "M4 7h16M6 7v12a2 2 0 002 2h8a2 2 0 002-2V7M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" };

/* One category card — shared by the home rail and the /categories grid so both
   stay pixel-identical. */
export function CategoryTile({ c }: { c: CategoryItem }) {
  const art = ART[c.slug] ?? FALLBACK;
  return (
    <Link href={`/products?category=${c.slug}`} className="cat-tile">
      <span className={`cat-media tone-${art.tone}`}>
        {c.image_key ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={c.image_key} alt="" loading="lazy" />
        ) : (
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={art.icon} />
          </svg>
        )}
      </span>
      <span className="cat-name">{c.name}</span>
      <span className="eyebrow">{c.product_count} products</span>
    </Link>
  );
}

export function CategoryRail({ categories }: { categories: CategoryItem[] }) {
  const rail = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    setAtStart(el.scrollLeft < 8);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [sync, categories.length]);

  // Scroll by one "page" of tiles so cards never end up half-cut.
  const page = (dir: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.8), behavior: "smooth" });
  };

  const scrollable = !(atStart && atEnd);

  return (
    <div className="cat-rail-wrap">
      {scrollable && (
        <button
          type="button"
          className="rail-arrow is-prev"
          onClick={() => page(-1)}
          disabled={atStart}
          aria-label="Scroll categories left"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
      )}

      <div className="cat-rail" ref={rail} onScroll={sync}>
        {categories.map((c) => (
          <CategoryTile key={c.id} c={c} />
        ))}
      </div>

      {scrollable && (
        <button
          type="button"
          className="rail-arrow is-next"
          onClick={() => page(1)}
          disabled={atEnd}
          aria-label="Scroll categories right"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      )}
    </div>
  );
}
