"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { inr, stockLabel } from "@/lib/format";
import { useSaved } from "@/lib/saved";

function ProductMedia({ src, alt }: { src?: string | null; alt: string }) {
  return (
    <span className="cmp-media">
      {src ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={src} alt={alt} loading="lazy" />
      ) : (
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <path d="M4 7h16M6 7v12a2 2 0 002 2h8a2 2 0 002-2V7M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
        </svg>
      )}
    </span>
  );
}

export default function ComparePage() {
  const { user, loading } = useAuth();
  const { compare, removeCompared, clearCompare } = useSaved();
  const { qtyForVariant, incVariant, decVariant } = useCart();

  const scroller = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const sync = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setAtStart(el.scrollLeft < 8);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [sync, compare?.count]);

  const page = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.7), behavior: "smooth" });
  };

  if (!loading && !user) {
    return (
      <div className="container section">
        <div className="card pad">
          Please <Link href="/login">sign in</Link> to compare products.
        </div>
      </div>
    );
  }

  if (!compare) return <div className="container section muted">Loading compare…</div>;

  const products = compare.items.map((it) => it.product);
  const scrollable = !(atStart && atEnd);

  return (
    <div className="container section">
      <div className="row spread">
        <h2>Compare products</h2>
        {compare.count > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={clearCompare}>
            Clear all
          </button>
        )}
      </div>
      <p className="muted small" style={{ marginTop: 4 }}>
        Up to {compare.max_items} products side by side — synced across your devices.
      </p>

      {compare.count === 0 ? (
        <div className="empty" style={{ marginTop: 18 }}>
          <span className="ic">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 3L4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4" />
            </svg>
          </span>
          <b style={{ color: "var(--ink)" }}>Nothing to compare yet</b>
          Use the compare toggle on any product to line them up here.
          <Link href="/products" className="btn btn-primary btn-sm" style={{ marginTop: 6 }}>
            Browse products
          </Link>
        </div>
      ) : (
        <div className="cmp-wrap" style={{ marginTop: 18 }}>
          {scrollable && (
            <button type="button" className="rail-arrow is-prev" onClick={() => page(-1)} disabled={atStart} aria-label="Scroll comparison left">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          )}

          <div className="cmp-scroll" ref={scroller} onScroll={sync}>
            <table className="cmp-table">
              <thead>
                <tr>
                  <th className="cmp-attr" scope="col">
                    <span className="eyebrow">{products.length} of {compare.max_items} selected</span>
                  </th>
                  {products.map((p) => (
                    <th key={p.id} scope="col">
                      <div className="cmp-head">
                        <button
                          type="button"
                          className="cmp-remove"
                          onClick={() => removeCompared(p.id)}
                          aria-label={`Remove ${p.name} from compare`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                        </button>
                        <Link href={`/products/${p.slug}`}>
                          <ProductMedia src={p.image_key} alt={p.name} />
                        </Link>
                        <Link href={`/products/${p.slug}`} className="cmp-name">
                          {p.name}
                        </Link>
                        <span className="cmp-price mono">{inr(p.price_min)}</span>
                        {p.default_variant_id && p.stock_status !== "out_of_stock" ? (
                          qtyForVariant(p.default_variant_id) === 0 ? (
                            <button type="button" className="add-btn" onClick={() => incVariant(p.default_variant_id!)}>
                              ADD
                            </button>
                          ) : (
                            <span className="stepper">
                              <button type="button" aria-label="Decrease quantity" onClick={() => decVariant(p.default_variant_id!)}>−</button>
                              <b>{qtyForVariant(p.default_variant_id)}</b>
                              <button type="button" aria-label="Increase quantity" onClick={() => incVariant(p.default_variant_id!)}>+</button>
                            </span>
                          )
                        ) : (
                          <button type="button" className="add-btn" disabled>
                            SOLD OUT
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th className="cmp-attr" scope="row">Price</th>
                  {products.map((p) => (
                    <td key={p.id}>
                      <strong className="mono">{inr(p.price_min)}</strong>
                      {p.price_max > p.price_min && (
                        <span className="muted small"> MRP {inr(p.price_max)}</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th className="cmp-attr" scope="row">Availability</th>
                  {products.map((p) => {
                    const stock = stockLabel(p.stock_status);
                    return (
                      <td key={p.id}>
                        <span className={`pill ${stock.cls}`}>{stock.text}</span>
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <th className="cmp-attr" scope="row">Rating</th>
                  {products.map((p) => (
                    <td key={p.id}>{p.rating > 0 ? `★ ${p.rating.toFixed(1)} (${p.reviews})` : "—"}</td>
                  ))}
                </tr>
                <tr>
                  <th className="cmp-attr" scope="row">Pack</th>
                  {products.map((p) => <td key={p.id}>{p.unit_label || "—"}</td>)}
                </tr>
                <tr>
                  <th className="cmp-attr" scope="row">Category</th>
                  {products.map((p) => <td key={p.id}>{p.category_name}</td>)}
                </tr>
                <tr>
                  <th className="cmp-attr" scope="row">Schedule</th>
                  {products.map((p) => (
                    <td key={p.id}>
                      {p.schedule && p.schedule !== "NONE" ? (
                        <span className="pill pill-rx">Rx · {p.schedule}</span>
                      ) : (
                        "OTC"
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th className="cmp-attr" scope="row">Delivery</th>
                  {products.map((p) => (
                    <td key={p.id}>{p.delivery_time_mins ? `${p.delivery_time_mins} min` : "Standard"}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {scrollable && (
            <button type="button" className="rail-arrow is-next" onClick={() => page(1)} disabled={atEnd} aria-label="Scroll comparison right">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
