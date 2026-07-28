"use client";

import { useState } from "react";
import { Donut } from "@/components/Charts";
import { inr } from "@/lib/format";
import { useApi } from "@/lib/useApi";

interface Rep {
  rep_id: string;
  name: string | null;
  phone: string;
  revenue_paise: number;
  orders: number;
  customers: number;
  aov_paise: number;
  month_target_paise: number | null;
  month_revenue_paise: number;
  attainment_pct: number | null;
}

const RANGES = [7, 30, 90];

/** Sales team — rep performance, targets and attainment. */
export default function SalesAnalytics() {
  const [days, setDays] = useState(30);
  const team = useApi<Rep[]>("/sales/team", { days });
  const reps = team.data ?? [];
  const totalRevenue = reps.reduce((n, r) => n + r.revenue_paise, 0);
  const best = reps[0];
  const withTargets = reps.filter((r) => r.attainment_pct != null);
  const avgAttainment = withTargets.length
    ? Math.round(withTargets.reduce((n, r) => n + (r.attainment_pct ?? 0), 0) / withTargets.length)
    : null;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="row spread">
        <span className="muted small">Attributed revenue: orders from customers assigned to each rep.</span>
        <div className="range-seg" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <button key={r} className={days === r ? "on" : ""} onClick={() => setDays(r)}>
              {r}d
            </button>
          ))}
        </div>
      </div>

      <div className="bento">
        <div className="tile">
          <h3>Team revenue</h3>
          <div className="big">{team.loading ? "…" : inr(totalRevenue)}</div>
          <span className="muted small">last {days} days, attributed</span>
        </div>
        <div className="tile">
          <h3>Reps</h3>
          <div className="big">{team.loading ? "…" : reps.length}</div>
          <span className="muted small">on the sales team</span>
        </div>
        <div className="tile">
          <h3>Top performer</h3>
          <div className="big" style={{ fontSize: "1.2rem" }}>{best ? (best.name ?? best.phone) : "—"}</div>
          <span className="muted small">{best ? inr(best.revenue_paise) : "no attributed sales yet"}</span>
        </div>
        <div className="tile">
          <h3>Target attainment</h3>
          <div className="big">{avgAttainment != null ? `${avgAttainment}%` : "—"}</div>
          <span className="muted small">{withTargets.length ? "average, this month" : "no targets set this month"}</span>
        </div>

        <div className="tile b2">
          <h3>
            Revenue share <span className="eyebrow">by rep</span>
          </h3>
          <Donut
            parts={reps.map((r) => ({ label: r.name ?? r.phone, value: r.revenue_paise }))}
            format={(n) => inr(n)}
            centerLabel="attributed"
          />
        </div>
        <div className="tile b2">
          <h3>
            Orders share <span className="eyebrow">by rep</span>
          </h3>
          <Donut
            parts={reps.map((r) => ({ label: r.name ?? r.phone, value: r.orders }))}
            centerLabel="orders"
          />
        </div>

        <div className="tile b4">
          <h3>
            Rep performance <span className="eyebrow">last {days} days</span>
          </h3>
          <table className="tbl">
            <thead>
              <tr>
                <th>Rep</th>
                <th className="num">Customers</th>
                <th className="num">Orders</th>
                <th className="num">Revenue</th>
                <th className="num">AOV</th>
                <th style={{ width: 220 }}>Month target</th>
              </tr>
            </thead>
            <tbody>
              {team.loading && (
                <tr><td colSpan={6} className="empty">Loading…</td></tr>
              )}
              {!team.loading && reps.length === 0 && (
                <tr><td colSpan={6} className="empty">No sales reps yet — add staff with the sales role.</td></tr>
              )}
              {reps.map((r) => (
                <tr key={r.rep_id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.name ?? "—"}</div>
                    <div className="muted small mono">{r.phone}</div>
                  </td>
                  <td className="num">{r.customers}</td>
                  <td className="num">{r.orders}</td>
                  <td className="num mono" style={{ fontWeight: 600 }}>{inr(r.revenue_paise)}</td>
                  <td className="num mono">{inr(r.aov_paise)}</td>
                  <td>
                    {r.month_target_paise ? (
                      <>
                        <span className="bar-track" style={{ display: "block" }}>
                          <span
                            className="bar-fill"
                            style={{ display: "block", width: `${Math.min(100, r.attainment_pct ?? 0)}%` }}
                          />
                        </span>
                        <span className="muted small">
                          {inr(r.month_revenue_paise)} of {inr(r.month_target_paise)} ({r.attainment_pct ?? 0}%)
                        </span>
                      </>
                    ) : (
                      <span className="muted small">no target set</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
