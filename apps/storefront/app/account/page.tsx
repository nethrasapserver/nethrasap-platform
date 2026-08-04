"use client";

import type { OrderListItem, ProductListItem } from "@nethrasap/api-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { KycPanel } from "@/components/KycPanel";
import { ProductCard } from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/Skeletons";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DEFAULT_TRUST } from "@/lib/content";
import { inr } from "@/lib/format";

export const dynamic = "force-dynamic";

const SHELF_SIZE = 10; // matches the home shelf: two complete rows of five

const STATUS_CLS: Record<string, string> = {
  delivered: "pill-ok",
  confirmed: "pill-ok",
  dispatched: "pill-rx",
  out_for_delivery: "pill-rx",
  placed: "pill-low",
  cancelled: "pill-out",
  payment_failed: "pill-out",
};

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="container section muted">Loading…</div>}>
      <AccountInner />
    </Suspense>
  );
}

function AccountInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [shelf, setShelf] = useState<ProductListItem[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    api
      .get<{ items: OrderListItem[] }>("/orders")
      .then((d) => setOrders(d.items))
      .catch(() => setOrders([]));

    // Featured first, then popular to fill — same rule as the home shelf, so
    // the grid never renders a ragged half-row while curation is in flight.
    Promise.all([
      api.get<{ items: ProductListItem[] }>("/products", { featured: true, limit: SHELF_SIZE }),
      api.get<{ items: ProductListItem[] }>("/products", { sort: "popular", limit: SHELF_SIZE }),
    ])
      .then(([featured, popular]) => {
        const seen = new Set(featured.items.map((p) => p.id));
        setShelf([...featured.items, ...popular.items.filter((p) => !seen.has(p.id))].slice(0, SHELF_SIZE));
      })
      .catch(() => setShelf([]));
  }, [user]);

  if (!user) return null;

  const firstName = (user.profile?.full_name ?? "there").split(" ")[0];

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/products?q=${encodeURIComponent(term)}` : "/products");
  }

  return (
    <div className="container section">
      {/* Welcome hero — greets the buyer, says what Nethrasap is in one line,
          and routes them onward (home, browse, or straight into search). */}
      <div className="card pad acct-hero">
        <div className="acct-hero-main">
          <span className="eyebrow">Your account</span>
          <div className="row spread acct-hello">
            <h2>Hello, {firstName} 👋</h2>
            <span className={`pill ${user.status === "active" ? "pill-ok" : "pill-low"}`}>
              {user.status.replace(/_/g, " ")}
            </span>
          </div>
          <p className="acct-blurb">
            Welcome to Nethrasap — India&apos;s audited healthcare supply platform. Order medicines,
            devices and clinic supplies with CDSCO-verified sourcing, GDP-compliant cold chain and
            pan-India delivery, paid on delivery.
          </p>
          <div className="acct-actions">
            <Link href="/" className="btn btn-primary">
              Go to home →
            </Link>
            <Link href="/products" className="btn btn-outline">
              Browse all products
            </Link>
          </div>
        </div>

        <form className="acct-search" onSubmit={submitSearch} role="search">
          <label htmlFor="acct-q" className="small muted">
            Looking for something specific?
          </label>
          <div className="acct-search-row">
            <input
              id="acct-q"
              className="input"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search medicines, devices…"
            />
            <button type="submit" className="btn btn-primary">
              Search
            </button>
          </div>
        </form>
      </div>

      {/* What we do — the same four promises the home page leads with. */}
      <div className="card pad trust-strip acct-trust">
        {DEFAULT_TRUST.map((t) => (
          <div key={t.title} className="trust-item">
            <span className="ic">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={t.icon} />
              </svg>
            </span>
            <span>
              <b style={{ display: "block", color: "var(--ink)" }}>{t.title}</b>
              {t.subtitle}
            </span>
          </div>
        ))}
      </div>

      <KycPanel />

      <div className="sec-head" style={{ marginTop: 28 }}>
        <h3 style={{ margin: 0 }}>Featured for you</h3>
        <Link href="/products" className="small">
          View all →
        </Link>
      </div>
      {shelf === null ? (
        <div className="grid grid-shelf">
          {Array.from({ length: 5 }, (_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : shelf.length === 0 ? (
        <div className="card pad muted">
          Nothing to show yet. <Link href="/products">Browse the catalogue →</Link>
        </div>
      ) : (
        <div className="grid grid-shelf">
          {shelf.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}

      <h3 style={{ marginTop: 28 }}>Your orders</h3>
      {orders.length === 0 ? (
        <div className="card pad muted">
          No orders yet. <Link href="/products">Start shopping →</Link>
        </div>
      ) : (
        <div className="card acct-orders" style={{ marginTop: 8 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Placed</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.order_number}>
                  <td>
                    <Link href={`/orders/${o.order_number}`} style={{ fontWeight: 600, color: "var(--brand-dark)" }}>
                      {o.order_number}
                    </Link>
                  </td>
                  <td className="muted small">{new Date(o.placed_at).toLocaleDateString("en-IN")}</td>
                  <td>
                    <span className={`pill ${STATUS_CLS[o.status] ?? "pill-rx"}`}>{o.status.replace(/_/g, " ")}</span>
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{inr(o.grand_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
