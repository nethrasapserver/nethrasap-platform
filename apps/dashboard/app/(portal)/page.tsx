"use client";

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

export default function DashboardHome() {
  const { user, can } = useAuth();
  const analytics = can("analytics:read");

  const kpis = useApi<Kpis>(analytics ? "/analytics/kpis" : null);
  const trend = useApi<{ series: TrendPoint[] }>(analytics ? "/analytics/revenue-trend" : null, { days: 14 });
  const top = useApi<{ items: TopProduct[] }>(analytics ? "/analytics/top-products" : null, { limit: 5 });

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
  const maxRev = Math.max(1, ...(trend.data?.series.map((p) => p.revenue_paise) ?? [1]));

  return (
    <div>
      <div className="page-head">
        <h1>Dashboard</h1>
        <span className="muted small">Last {k?.window_days ?? 30} days</span>
      </div>

      <div className="grid kpis">
        <Kpi label="Revenue" value={inr(k?.revenue_paise)} loading={kpis.loading} />
        <Kpi label="Orders" value={k?.orders ?? "—"} loading={kpis.loading} />
        <Kpi label="Avg order value" value={inr(k?.aov_paise)} loading={kpis.loading} />
        <Kpi label="Unique buyers" value={k?.unique_buyers ?? "—"} loading={kpis.loading} />
        <Kpi label="Awaiting payment" value={k?.awaiting_payment ?? "—"} loading={kpis.loading} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.6fr 1fr", marginTop: 16, alignItems: "start" }}>
        <div className="card pad">
          <h3>Revenue — last 14 days</h3>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 180, marginTop: 12 }}>
            {trend.data?.series.map((p) => (
              <div key={p.date} className="grow" style={{ textAlign: "center" }} title={`${p.date}: ${inr(p.revenue_paise)}`}>
                <div
                  style={{
                    height: `${(p.revenue_paise / maxRev) * 150}px`,
                    minHeight: 2,
                    background: p.revenue_paise > 0 ? "var(--brand)" : "var(--line)",
                    borderRadius: "4px 4px 0 0",
                  }}
                />
              </div>
            ))}
          </div>
          <div className="muted small" style={{ marginTop: 6 }}>
            {trend.data?.series[0]?.date} → {trend.data?.series.at(-1)?.date}
          </div>
        </div>

        <div className="card pad">
          <h3>Top products</h3>
          {top.data?.items.length ? (
            <table className="tbl" style={{ marginTop: 8 }}>
              <tbody>
                {top.data.items.map((p) => (
                  <tr key={p.product_name}>
                    <td>{p.product_name}</td>
                    <td className="num muted">{p.units}u</td>
                    <td className="num" style={{ fontWeight: 600 }}>
                      {inr(p.revenue_paise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">No sales yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, loading }: { label: string; value: React.ReactNode; loading: boolean }) {
  return (
    <div className="card pad kpi">
      <div className="label">{label}</div>
      <div className="value">{loading ? "…" : value}</div>
    </div>
  );
}
