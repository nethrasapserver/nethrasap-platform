"use client";

import Link from "next/link";
import { RevenueChart, Spark } from "@/components/Charts";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { inr } from "@/lib/format";
import { useApi } from "@/lib/useApi";

interface Kpis {
  window_days: number;
  revenue_paise: number;
  orders: number;
  unique_buyers: number;
  aov_paise: number;
  awaiting_payment: number;
}
interface TrendPoint {
  date: string;
  revenue_paise: number;
  orders: number;
}
interface TopProduct {
  product_name: string;
  units: number;
  revenue_paise: number;
}
interface Enquiry {
  id: string;
  reference: string;
  quoted_total: number | null;
  items: { product_name: string; quantity: number }[];
}
interface StockLevel {
  level_id: string;
  product_name: string;
  pack_size: string;
  available: number;
  reorder_point: number;
}
interface AdminOrder {
  order_number: string;
  status: string;
  grand_total: number;
  customer_name: string;
}

const RANGES = [7, 30, 90];

function TileIcon({ d }: { d: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** Structured empty state for the ops queue cards — keeps the panel's frame. */
function PanelEmpty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="dash-empty">
      <span className="ic"><TileIcon d={icon} /></span>
      <span>{text}</span>
    </div>
  );
}

export default function DashboardHome() {
  const { user, can } = useAuth();
  const analytics = can("analytics:read");
  const [days, setDays] = useState(30);

  const kpis = useApi<Kpis>(analytics ? "/analytics/kpis" : null, { days });
  const trend = useApi<{ series: TrendPoint[] }>(analytics ? "/analytics/revenue-trend" : null, { days });
  const top = useApi<{ items: TopProduct[] }>(analytics ? "/analytics/top-products" : null, { days, limit: 5 });

  // Actionable ops queues (independent of the date range).
  const canApprove = can("enquiries:approve");
  const canInventory = can("inventory:write");
  const canOrders = can("orders:fulfil");
  const pendingQuotes = useApi<Enquiry[]>(canApprove ? "/admin/enquiries" : null, { approval: "pending" });
  const lowStock = useApi<StockLevel[]>(canInventory ? "/admin/inventory" : null, { low_only: true });
  const recentOrders = useApi<{ items: AdminOrder[] }>(canOrders ? "/admin/orders" : null, { limit: 5 });

  if (!analytics) {
    return (
      <div>
        <h1>Welcome, {user?.profile?.full_name}</h1>
        <div className="card empty" style={{ marginTop: 16 }}>
          Use the sidebar to reach your queues. You don&apos;t have analytics access.
        </div>
      </div>
    );
  }

  const k = kpis.data;
  const series = trend.data?.series ?? [];
  const revSeries = series.map((p) => p.revenue_paise);
  const orderSeries = series.map((p) => p.orders);
  const maxTop = Math.max(1, ...(top.data?.items ?? []).map((x) => x.revenue_paise));

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <h1>Dashboard</h1>
        <div className="range-seg" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <button key={r} className={days === r ? "on" : ""} onClick={() => setDays(r)}>
              {r}d
            </button>
          ))}
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi k-hero">
          <span className="lab">
            <span className="ic"><TileIcon d="M3 17l5-6 4 3 5-7 4 5" /></span>
            Revenue
          </span>
          <span className="val">{kpis.loading ? "…" : inr(k?.revenue_paise)}</span>
          <span className="delta">
            AOV {inr(k?.aov_paise)} <small>per order</small>
          </span>
          <Spark id="sg-rev" series={revSeries} line="#606c38" fill="#606c38" dot="#283618" />
        </div>
        <Link href="/orders" className="kpi k-clay" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="lab">
            <span className="ic"><TileIcon d="M6 6h15l-1.5 8H8L6 3H3" /></span>
            Orders
          </span>
          <span className="val">{kpis.loading ? "…" : k?.orders ?? "—"}</span>
          <span className="delta">
            <small>last {k?.window_days ?? days} days</small>
          </span>
          <Spark id="sg-ord" series={orderSeries} line="#bc6c25" fill="#dda15e" dot="#bc6c25" />
        </Link>
        <div className="kpi k-info">
          <span className="lab">
            <span className="ic"><TileIcon d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9.5 11a4 4 0 100-8 4 4 0 000 8z" /></span>
            Unique buyers
          </span>
          <span className="val">{kpis.loading ? "…" : k?.unique_buyers ?? "—"}</span>
          <span className="delta"><small>active customers</small></span>
        </div>
        <Link href="/orders" className="kpi k-copper" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="lab">
            <span className="ic"><TileIcon d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /></span>
            Awaiting payment
          </span>
          <span className="val">{kpis.loading ? "…" : k?.awaiting_payment ?? "—"}</span>
          <span className={`delta ${(k?.awaiting_payment ?? 0) > 0 ? "down" : ""}`}>
            <small>orders pending capture</small>
          </span>
        </Link>
      </div>

      <div className="grid two-col-dash" style={{ gridTemplateColumns: "1.6fr 1fr", alignItems: "start" }}>
        <div className="card">
          <div className="panel-head">
            <h3>Revenue — last {days} days</h3>
            <span className="eyebrow">daily</span>
          </div>
          <div className="panel-body">
            <RevenueChart series={series} days={days} />
          </div>
        </div>

        <div className="card">
          <div className="panel-head">
            <h3>Top products</h3>
            <span className="eyebrow">by revenue</span>
          </div>
          <div className="panel-body" style={{ display: "grid", gap: 16 }}>
            {(top.data?.items ?? []).map((t, i) => (
              <div key={t.product_name} className="bar-row" title={`${t.product_name} — ${t.units} units · ${inr(t.revenue_paise)}`}>
                <span className="bar-rank">{i + 1}</span>
                <span className="bar-name">
                  <b>{t.product_name}</b>
                  <small>{t.units} unit{t.units === 1 ? "" : "s"} sold</small>
                </span>
                <span className="bar-track">
                  <span className="bar-fill" style={{ display: "block", width: `${(t.revenue_paise / maxTop) * 100}%` }} />
                </span>
                <span className="bar-amt">{inr(t.revenue_paise)}</span>
              </div>
            ))}
            {top.data && top.data.items.length === 0 && (
              <>
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="bar-row is-ghost">
                    <span className="bar-rank">{i + 1}</span>
                    <span className="bar-name"><b>—</b></span>
                    <span className="bar-track" />
                    <span className="bar-amt">₹0</span>
                  </div>
                ))}
                <div className="muted small" style={{ textAlign: "center", marginTop: 4 }}>
                  No sales in this period.
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Actionable ops queues */}
      <div className="dash-actions">
        {canApprove && (
          <div className="card">
            <div className="panel-head">
              <h3>Quotes awaiting approval</h3>
              <Link href="/enquiries" className="eyebrow">Open →</Link>
            </div>
            <div className="panel-body dash-list">
              {(pendingQuotes.data ?? []).slice(0, 5).map((e) => (
                <div key={e.id} className="dash-row">
                  <b className="mono">{e.reference}</b>
                  <span className="muted small">{e.items.length} item{e.items.length === 1 ? "" : "s"}</span>
                  <span className="mono small">{inr(e.quoted_total)}</span>
                </div>
              ))}
              {pendingQuotes.data && pendingQuotes.data.length === 0 && (
                <PanelEmpty
                  icon="M9 12l2 2 4-4M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7z"
                  text="Nothing awaiting approval. Quotes drafted by sales appear here for release."
                />
              )}
            </div>
          </div>
        )}

        {canInventory && (
          <div className="card">
            <div className="panel-head">
              <h3>Low stock</h3>
              <Link href="/inventory" className="eyebrow">Open →</Link>
            </div>
            <div className="panel-body dash-list">
              {(lowStock.data ?? []).slice(0, 5).map((s) => (
                <div key={s.level_id} className="dash-row">
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.product_name} <span className="muted small">· {s.pack_size}</span>
                  </span>
                  <span className={`pill ${s.available <= 0 ? "pill-err" : "pill-warn"}`}>{s.available} left</span>
                </div>
              ))}
              {lowStock.data && lowStock.data.length === 0 && (
                <PanelEmpty
                  icon="M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"
                  text="All stock healthy. Items appear when they fall below their reorder point."
                />
              )}
            </div>
          </div>
        )}

        {canOrders && (
          <div className="card">
            <div className="panel-head">
              <h3>Recent orders</h3>
              <Link href="/orders" className="eyebrow">Open →</Link>
            </div>
            <div className="panel-body dash-list">
              {(recentOrders.data?.items ?? []).map((o) => (
                <Link key={o.order_number} href={`/orders?open=${o.order_number}`} className="dash-row dash-row-link">
                  <b className="mono">{o.order_number}</b>
                  <span className="muted small" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.customer_name}</span>
                  <span className="mono small">{inr(o.grand_total)}</span>
                </Link>
              ))}
              {recentOrders.data && recentOrders.data.items.length === 0 && (
                <PanelEmpty
                  icon="M6 6h15l-1.5 8H8L6 3H3M9 20a1.6 1.6 0 100-3.2A1.6 1.6 0 009 20zm9 0a1.6 1.6 0 100-3.2A1.6 1.6 0 0018 20z"
                  text="No orders yet. New orders land here as they are placed."
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
