"use client";

import { useMemo, useRef, useState } from "react";
import { inr } from "@/lib/format";

export interface TrendPoint {
  date: string;
  revenue_paise: number;
  orders: number;
}

/** Brand-anchored data-viz palette — olive first, then distinct hues. */
export const CHART_COLORS = [
  "#606c38", // olive
  "#bc6c25", // copper
  "#2b6b7f", // ice/info
  "#dda15e", // clay
  "#b94824", // rose
  "#8a9a5b", // sage
  "#5d8aa8", // slate blue
  "#283618", // black forest
];

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

/* ============================== Line chart ============================== */

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
  format: (n: number) => string;
}

const LW = 640; // viewBox width
const LH = 240; // viewBox height
const PAD = { top: 14, right: 14, bottom: 26, left: 46 };

/** Interactive multi-series line chart: hover guide + tooltip, per-series
    normalised scales, legend toggles. Pure SVG, no dependencies. */
export function LineChart({
  labels,
  series,
  yFormat,
}: {
  labels: string[];
  series: LineSeries[];
  /** Axis labels come from the FIRST series' scale. */
  yFormat?: (n: number) => string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const n = labels.length;
  const innerW = LW - PAD.left - PAD.right;
  const innerH = LH - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);

  const visible = series.filter((s) => !hidden.has(s.key));
  const scaled = useMemo(
    () =>
      visible.map((s) => {
        const max = Math.max(1, ...s.values);
        return {
          ...s,
          max,
          pts: s.values.map((v, i) => [x(i), PAD.top + innerH - (v / max) * innerH] as const),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, hidden, n],
  );

  const primary = scaled[0];
  const tickEvery = n > 60 ? 15 : n > 14 ? 5 : n > 7 ? 2 : 1;
  const fmt = yFormat ?? primary?.format ?? String;

  function onMove(e: React.MouseEvent) {
    const rect = wrap.current?.querySelector("svg")?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const px = ((e.clientX - rect.left) / rect.width) * LW;
    const i = Math.round(((px - PAD.left) / innerW) * (n - 1));
    setHoverIdx(Math.max(0, Math.min(n - 1, i)));
  }

  const path = (pts: readonly (readonly [number, number])[]) =>
    pts.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");

  const allZero = series.every((s) => s.values.every((v) => v === 0));

  return (
    <div ref={wrap} style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${LW} ${LH}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
        role="img"
        aria-label="Trend chart"
      >
        {/* gridlines + y labels off the primary scale */}
        {[0, 0.5, 1].map((f) => {
          const gy = PAD.top + innerH - f * innerH;
          return (
            <g key={f}>
              <line x1={PAD.left} x2={LW - PAD.right} y1={gy} y2={gy} stroke="var(--line)" strokeDasharray={f === 0 ? "" : "4 4"} />
              <text x={PAD.left - 8} y={gy + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">
                {primary && !allZero ? fmt(primary.max * f) : f === 0 ? "0" : ""}
              </text>
            </g>
          );
        })}
        {/* x ticks */}
        {labels.map((l, i) =>
          i % tickEvery === 0 || i === n - 1 ? (
            <text key={l + i} x={x(i)} y={LH - 8} textAnchor="middle" fontSize="11" fill="var(--ink-3)">
              {fmtDay(l)}
            </text>
          ) : null,
        )}
        {/* hover guide */}
        {hoverIdx != null && (
          <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--line-2)" strokeWidth="1.5" />
        )}
        {/* series: primary gets a flat area fill */}
        {scaled.map((s, si) => (
          <g key={s.key}>
            {si === 0 && (
              <path
                d={`${path(s.pts)} L${x(n - 1)} ${PAD.top + innerH} L${x(0)} ${PAD.top + innerH} Z`}
                fill={s.color}
                fillOpacity=".1"
              />
            )}
            <path d={path(s.pts)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {hoverIdx != null && s.pts[hoverIdx] && (
              <circle cx={s.pts[hoverIdx][0]} cy={s.pts[hoverIdx][1]} r="4.5" fill={s.color} stroke="#fff" strokeWidth="2" />
            )}
          </g>
        ))}
        {allZero && (
          <text x={LW / 2} y={LH / 2} textAnchor="middle" fontSize="13" fill="var(--ink-3)">
            No data in this period
          </text>
        )}
      </svg>

      {/* tooltip */}
      {hoverIdx != null && !allZero && (
        <div
          style={{
            position: "absolute",
            left: `${(x(hoverIdx) / LW) * 100}%`,
            top: 0,
            transform: `translateX(${hoverIdx > n / 2 ? "calc(-100% - 10px)" : "10px"})`,
            background: "var(--brand-900)",
            color: "var(--cream)",
            borderRadius: 10,
            padding: "8px 12px",
            fontSize: ".78rem",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            boxShadow: "var(--sh-md)",
            zIndex: 5,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{fmtDay(labels[hoverIdx])}</div>
          {visible.map((s) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: s.color, display: "inline-block" }} />
              {s.label}: <b>{s.format(s.values[hoverIdx])}</b>
            </div>
          ))}
        </div>
      )}

      {/* legend toggles */}
      {series.length > 1 && (
        <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {series.map((s) => {
            const off = hidden.has(s.key);
            return (
              <button
                key={s.key}
                type="button"
                className="chip-toggle"
                style={{ opacity: off ? 0.45 : 1 }}
                onClick={() =>
                  setHidden((h) => {
                    const next = new Set(h);
                    if (next.has(s.key)) next.delete(s.key);
                    else if (next.size < series.length - 1) next.add(s.key);
                    return next;
                  })
                }
                aria-pressed={!off}
              >
                <span style={{ width: 9, height: 9, borderRadius: 99, background: s.color, display: "inline-block" }} />
                {s.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Revenue + orders trend — the standard two-line chart used everywhere. */
export function RevenueChart({ series, days }: { series: TrendPoint[]; days: number }) {
  const points: TrendPoint[] =
    series.length > 0
      ? series
      : Array.from({ length: days }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (days - 1 - i));
          return { date: d.toISOString().slice(0, 10), revenue_paise: 0, orders: 0 };
        });
  return (
    <LineChart
      labels={points.map((p) => p.date)}
      yFormat={compactInr}
      series={[
        { key: "revenue", label: "Revenue", color: CHART_COLORS[0], values: points.map((p) => p.revenue_paise), format: (n) => inr(n) },
        { key: "orders", label: "Orders", color: CHART_COLORS[1], values: points.map((p) => p.orders), format: (n) => `${n}` },
      ]}
    />
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

/* ============================== Donut chart ============================== */

function arcPath(cx: number, cy: number, r1: number, r2: number, a0: number, a1: number) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p = (r: number, a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = p(r2, a0);
  const [x1, y1] = p(r2, a1);
  const [x2, y2] = p(r1, a1);
  const [x3, y3] = p(r1, a0);
  return `M${x0} ${y0} A${r2} ${r2} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r1} ${r1} 0 ${large} 0 ${x3} ${y3} Z`;
}

export interface DonutPart {
  label: string;
  value: number;
  color?: string;
}

/** Interactive donut: hover lifts a segment, the centre and legend follow.
    Colors cycle the brand palette unless a part pins its own. */
export function Donut({
  parts,
  format = (n) => String(n),
  centerLabel,
  size = 190,
}: {
  parts: DonutPart[];
  format?: (n: number) => string;
  /** Text under the total in the middle (e.g. "orders"). */
  centerLabel?: string;
  size?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const data = parts.filter((p) => p.value > 0);
  const total = data.reduce((n, p) => n + p.value, 0);
  const R = 100;
  const r1 = 62;
  const gap = data.length > 1 ? 0.028 : 0;

  let angle = -Math.PI / 2;
  const segs = data.map((p, i) => {
    const frac = p.value / Math.max(1, total);
    const a0 = angle + gap / 2;
    const a1 = angle + Math.max(gap, frac * Math.PI * 2) - gap / 2;
    angle += frac * Math.PI * 2;
    const mid = (a0 + a1) / 2;
    return { ...p, i, a0, a1: Math.min(a1, a0 + Math.PI * 2 - 0.0001), mid, color: p.color ?? CHART_COLORS[i % CHART_COLORS.length] };
  });

  const shown = active != null ? data[active] : null;

  return (
    <div className="row" style={{ gap: 20, alignItems: "center", flexWrap: "wrap" }}>
      <svg
        viewBox="-110 -110 220 220"
        style={{ width: size, height: size, flex: "none" }}
        role="img"
        aria-label={centerLabel ?? "Distribution"}
      >
        {segs.map((s) => (
          <path
            key={s.label}
            d={arcPath(0, 0, r1, R, s.a0, s.a1)}
            fill={s.color}
            opacity={active == null || active === s.i ? 1 : 0.35}
            style={{
              transform: active === s.i ? `translate(${Math.cos(s.mid) * 6}px, ${Math.sin(s.mid) * 6}px)` : undefined,
              transition: "transform .15s ease, opacity .15s ease",
              cursor: "pointer",
            }}
            onMouseEnter={() => setActive(s.i)}
            onMouseLeave={() => setActive(null)}
          >
            <title>{`${s.label}: ${format(s.value)}`}</title>
          </path>
        ))}
        {total === 0 && <circle r={R} fill="none" stroke="var(--line)" strokeWidth={R - r1} />}
        <text y="-4" textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--ink)" style={{ fontVariantNumeric: "tabular-nums" }}>
          {shown ? format(shown.value) : format(total)}
        </text>
        <text y="18" textAnchor="middle" fontSize="11.5" fill="var(--ink-3)">
          {shown ? shown.label.slice(0, 18) : centerLabel ?? "total"}
        </text>
      </svg>

      <div style={{ display: "grid", gap: 7, minWidth: 150, flex: 1 }}>
        {segs.map((s) => (
          <button
            key={s.label}
            type="button"
            className="legend-row"
            style={{ opacity: active == null || active === s.i ? 1 : 0.45 }}
            onMouseEnter={() => setActive(s.i)}
            onMouseLeave={() => setActive(null)}
          >
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flex: "none" }} />
            <span className="legend-lab">{s.label}</span>
            <span className="mono small" style={{ fontWeight: 600 }}>
              {format(s.value)}
            </span>
            <span className="muted small" style={{ width: 42, textAlign: "right" }}>
              {total ? Math.round((s.value / total) * 100) : 0}%
            </span>
          </button>
        ))}
        {data.length === 0 && <p className="muted small" style={{ margin: 0 }}>No data in this period.</p>}
      </div>
    </div>
  );
}

/** Horizontal label · meter · value rows, colored per rank. */
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
      {rows.map((r, i) => (
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
            <span
              className="bar-fill"
              style={{ display: "block", width: `${(r.value / max) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length] }}
            />
          </span>
          <span className="bar-amt">{format(r.value)}</span>
        </div>
      ))}
      {rows.length === 0 && <p className="muted small" style={{ margin: 0 }}>No data in this period.</p>}
    </div>
  );
}

/** Single stacked distribution bar with a legend (health splits, mixes). */
export function DistBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
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
