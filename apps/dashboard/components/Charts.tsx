"use client";

import { inr } from "@/lib/format";

export interface TrendPoint {
  date: string;
  revenue_paise: number;
  orders: number;
}

/** Compact rupee labels for chart axes: ₹950 · ₹8.6k · ₹1.2L */
export function compactInr(paise: number): string {
  const r = paise / 100;
  if (r >= 100_000) return `₹${(r / 100_000).toFixed(r % 100_000 ? 1 : 0)}L`;
  if (r >= 1_000) return `₹${(r / 1_000).toFixed(r % 1_000 ? 1 : 0)}k`;
  return `₹${Math.round(r)}`;
}

export function fmtDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Daily revenue bar chart: y-axis, gridlines, baseline, date ticks. Always
    draws the full frame — an empty or all-zero window shows flat day stubs
    with a centred note, never a blank panel. */
export function RevenueChart({ series, days }: { series: TrendPoint[]; days: number }) {
  const points: TrendPoint[] =
    series.length > 0
      ? series
      : Array.from({ length: days }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (days - 1 - i));
          return { date: d.toISOString().slice(0, 10), revenue_paise: 0, orders: 0 };
        });
  const max = Math.max(1, ...points.map((p) => p.revenue_paise));
  const allZero = points.every((p) => p.revenue_paise === 0);
  const tickEvery = points.length > 60 ? 15 : points.length > 14 ? 5 : 1;

  return (
    <div className="chart">
      <div className="chart-y" aria-hidden="true">
        <span>{allZero ? "" : compactInr(max)}</span>
        <span>{allZero ? "" : compactInr(max / 2)}</span>
        <span>₹0</span>
      </div>
      <div className="chart-plot">
        <div className="chart-grid" aria-hidden="true">
          <i style={{ top: 0 }} />
          <i style={{ top: "50%" }} />
        </div>
        <div className="chart-bars" style={{ gap: points.length > 40 ? 2 : 5 }}>
          {points.map((p) => (
            <div key={p.date} className="chart-slot" title={`${fmtDay(p.date)}: ${inr(p.revenue_paise)}`}>
              <div
                className={`chart-bar ${p.revenue_paise > 0 ? "" : "zero"}`}
                style={p.revenue_paise > 0 ? { height: `${Math.max(4, (p.revenue_paise / max) * 166)}px` } : undefined}
              />
            </div>
          ))}
        </div>
        <div className="chart-x" style={{ gap: points.length > 40 ? 2 : 5 }} aria-hidden="true">
          {points.map((p, i) => (
            <span key={p.date}>{i % tickEvery === 0 || i === points.length - 1 ? fmtDay(p.date) : ""}</span>
          ))}
        </div>
        {allZero && <div className="chart-note">No revenue in this period</div>}
      </div>
    </div>
  );
}

/** Sparkline with a flat translucent area fill + emphasized endpoint. */
export function Spark({ id, series, line, fill, dot }: { id: string; series: number[]; line: string; fill: string; dot: string }) {
  if (series.length < 2) return null;
  const max = Math.max(...series, 1);
  const pts = series.map((v, i) => [(i / (series.length - 1)) * 120, 40 - (v / max) * 32]);
  const path = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg className="spark" viewBox="0 0 120 44" preserveAspectRatio="none" aria-hidden="true" data-spark={id}>
      <path d={`${path} L120 44 L0 44 Z`} fill={fill} fillOpacity=".14" />
      <path d={path} fill="none" stroke={line} strokeWidth="2" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill={dot} />
    </svg>
  );
}

/** Horizontal label · meter · value rows — the analytics workhorse. */
export function BarList({
  rows,
  format = (n) => String(n),
}: {
  rows: { label: string; value: number; sub?: string }[];
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {rows.map((r) => (
        <div
          key={r.label}
          title={`${r.label}: ${format(r.value)}`}
          style={{ display: "grid", gridTemplateColumns: "1fr 96px 90px", gap: 12, alignItems: "center" }}
        >
          <span className="bar-name">
            <b>{r.label}</b>
            {r.sub && <small>{r.sub}</small>}
          </span>
          <span className="bar-track">
            <span className="bar-fill" style={{ display: "block", width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="bar-amt">{format(r.value)}</span>
        </div>
      ))}
      {rows.length === 0 && <p className="muted small" style={{ margin: 0 }}>No data in this period.</p>}
    </div>
  );
}

/** Single stacked distribution bar with a legend (health splits, mixes). */
export function DistBar({
  parts,
}: {
  parts: { label: string; value: number; color: string }[];
}) {
  const total = Math.max(1, parts.reduce((n, p) => n + p.value, 0));
  return (
    <div>
      <div style={{ display: "flex", height: 12, borderRadius: 99, overflow: "hidden", background: "var(--paper-3)" }}>
        {parts.filter((p) => p.value > 0).map((p) => (
          <span key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={`${p.label}: ${p.value}`} />
        ))}
      </div>
      <div className="row" style={{ gap: 14, marginTop: 10, flexWrap: "wrap" }}>
        {parts.map((p) => (
          <span key={p.label} className="small" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: 99, background: p.color, display: "inline-block" }} />
            {p.label} <b>{p.value}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
