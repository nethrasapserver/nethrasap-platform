"use client";

import { inr } from "@/lib/format";
import { useApi } from "@/lib/useApi";

interface RepPerf {
  rep_id: string;
  name: string | null;
  phone: string;
  revenue_paise: number;
  orders: number;
  customers: number;
  aov_paise: number;
  attainment_pct: number | null;
  month_target_paise: number | null;
}

export default function TeamPage() {
  const { data, loading } = useApi<{ team: RepPerf[] }>("/sales/team");

  return (
    <div>
      <div className="page-head">
        <h1>Sales team</h1>
        <span className="muted small">Last 30 days</span>
      </div>
      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Rep</th>
              <th className="num">Revenue</th>
              <th className="num">Orders</th>
              <th className="num">Customers</th>
              <th className="num">AOV</th>
              <th className="num">Target</th>
              <th className="num">Attainment</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="empty">
                  Loading…
                </td>
              </tr>
            )}
            {data?.team.map((r) => (
              <tr key={r.rep_id}>
                <td style={{ fontWeight: 600 }}>{r.name ?? r.phone}</td>
                <td className="num">{inr(r.revenue_paise)}</td>
                <td className="num">{r.orders}</td>
                <td className="num">{r.customers}</td>
                <td className="num">{inr(r.aov_paise)}</td>
                <td className="num muted">{inr(r.month_target_paise)}</td>
                <td className="num">
                  {r.attainment_pct != null ? (
                    <span className={`pill ${r.attainment_pct >= 100 ? "pill-ok" : "pill-warn"}`}>
                      {r.attainment_pct}%
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {!loading && data?.team.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  No sales reps yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
