"use client";

import { useState } from "react";
import { compactInr, Donut, RevenueChart, Spark, type TrendPoint } from "@/components/Charts";
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
interface TopProduct {
  product_name: string;
  units: number;
  revenue_paise: number;
}
interface AdminOrder {
  order_number: string;
  status: string;
  payment_status: string;
  grand_total: number;
}

const RANGES = [7, 30, 90];
const label = (s: string) => s.replace(/_/g, " ");

/** Overview — the whole business at a glance, bento-style. */
export default function AnalyticsOverview() {
  const [days, setDays] = useState(30);
  const kpis = useApi<Kpis>("/analytics/kpis", { days });
  const trend = useApi<{ series: TrendPoint[] }>("/analytics/revenue-trend", { days });
  const top = useApi<{ items: TopProduct[] }>("/analytics/top-products", { days, limit: 6 });
  // Status/payment mixes aggregate a recent-orders sample client-side.
  const orders = useApi<{ items: AdminOrder[]; total: number }>("/admin/orders", { limit: 200 });

  const k = kpis.data;
  const series = trend.data?.series ?? [];
  const sample = orders.data?.items ?? [];
  const countBy = (key: "status" | "payment_status") =>
    Object.entries(
      sample.reduce<Record<string, number>>((acc, o) => {
        acc[o[key]] = (acc[o[key]] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .map(([labelKey, value]) => ({ label: label(labelKey), value }))
      .sort((a, b) => b.value - a.value);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="row spread">
        <span className="muted small">Everything below follows the selected window.</span>
        <div className="range-seg" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <button key={r} className={days === r ? "on" : ""} onClick={() => setDays(r)}>
              {r}d
            </button>
          ))}
        </div>
      </div>

      <div className="bento">
        <div className="tile b2 r2">
          <h3>
            Revenue — last {days} days <span className="eyebrow">daily</span>
          </h3>
          <div className="big">{kpis.loading ? "…" : inr(k?.revenue_paise)}</div>
          <RevenueChart series={series} days={days} />
        </div>

        <div className="tile">
          <h3>Orders</h3>
          <div className="big">{k?.orders ?? "…"}</div>
          <span className="muted small">last {days} days</span>
          <Spark id="ao" series={series.map((p) => p.orders)} line="#bc6c25" fill="#dda15e" dot="#bc6c25" />
        </div>
        <div className="tile">
          <h3>Average order value</h3>
          <div className="big">{k ? inr(k.aov_paise) : "…"}</div>
          <span className="muted small">per order in the window</span>
        </div>
        <div className="tile">
          <h3>Unique buyers</h3>
          <div className="big">{k?.unique_buyers ?? "…"}</div>
          <span className="muted small">customers who ordered</span>
        </div>
        <div className="tile">
          <h3>Awaiting payment</h3>
          <div className="big" style={{ color: (k?.awaiting_payment ?? 0) > 0 ? "var(--danger)" : undefined }}>
            {k?.awaiting_payment ?? "…"}
          </div>
          <span className="muted small">orders pending capture</span>
        </div>

        <div className="tile b2">
          <h3>
            Orders by status <span className="eyebrow">latest {sample.length}</span>
          </h3>
          <Donut parts={countBy("status")} centerLabel="orders" />
        </div>
        <div className="tile b2">
          <h3>
            Payment mix <span className="eyebrow">latest {sample.length}</span>
          </h3>
          <Donut parts={countBy("payment_status")} centerLabel="orders" />
        </div>

        <div className="tile b2">
          <h3>
            Top products <span className="eyebrow">by revenue</span>
          </h3>
          <Donut
            parts={(top.data?.items ?? []).map((t) => ({ label: t.product_name, value: t.revenue_paise }))}
            format={(n) => compactInr(n)}
            centerLabel="revenue"
          />
        </div>
        <div className="tile b2">
          <h3>
            Order health <span className="eyebrow">latest {sample.length}</span>
          </h3>
          <Donut
            centerLabel="orders"
            parts={[
              { label: "Delivered", value: sample.filter((o) => o.status === "delivered").length, color: "#606c38" },
              { label: "In progress", value: sample.filter((o) => ["placed", "confirmed", "packed", "dispatched", "out_for_delivery"].includes(o.status)).length, color: "#dda15e" },
              { label: "Cancelled/failed", value: sample.filter((o) => ["cancelled", "payment_failed", "refunded"].includes(o.status)).length, color: "#b94824" },
            ]}
          />
          <p className="muted small" style={{ margin: 0 }}>
            {orders.data?.total ?? "…"} orders all time — mixes computed on the latest {sample.length}.
          </p>
        </div>
      </div>
    </div>
  );
}
