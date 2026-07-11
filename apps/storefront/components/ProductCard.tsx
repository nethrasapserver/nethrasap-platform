"use client";

import type { ProductListItem } from "@nethrasap/api-client";
import Link from "next/link";
import { inr, stockLabel } from "@/lib/format";

export function ProductCard({ p }: { p: ProductListItem }) {
  const stock = stockLabel(p.stock_status);
  return (
    <Link href={`/products/${p.slug}`} className="card pcard">
      <div className="thumb">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M4 7h16M6 7v12a2 2 0 002 2h8a2 2 0 002-2V7M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
        </svg>
      </div>
      <div className="body">
        <div className="brand">{p.brand}</div>
        <div className="name">{p.name}</div>
        <div className="row small" style={{ gap: 8 }}>
          <span className={`pill ${stock.cls}`}>{stock.text}</span>
          {p.schedule && p.schedule !== "NONE" && (
            <span className="pill pill-rx">Rx · {p.schedule}</span>
          )}
        </div>
        <div className="price">
          {inr(p.price_min)}
          {p.price_max && p.price_max !== p.price_min && (
            <span className="muted small" style={{ fontWeight: 400 }}>
              {" "}
              – {inr(p.price_max)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
