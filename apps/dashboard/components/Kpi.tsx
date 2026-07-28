"use client";

export interface KpiItem {
  label: string;
  value: string | number;
  /** Small caption under the value. */
  sub?: string;
  /** Inline SVG path (24x24 stroke icon). */
  icon: string;
  tone?: "brand" | "clay" | "info" | "copper" | "ok" | "danger";
  /** Makes the card a filter button. */
  onClick?: () => void;
  active?: boolean;
}

/** The dashboard-home KPI card, reusable on every page. Cards are plain
    stats by default; give an item onClick to make it a filter tile. */
export function KpiRow({ items }: { items: KpiItem[] }) {
  return (
    <div className="kpi-row">
      {items.map((it) => {
        const cls = `kpi k-flat t-${it.tone ?? "brand"} ${it.active ? "is-active" : ""}`;
        const inner = (
          <>
            <span className="lab">
              <span className="ic">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={it.icon} />
                </svg>
              </span>
              {it.label}
            </span>
            <span className="val">{it.value}</span>
            {it.sub && (
              <span className="delta">
                <small>{it.sub}</small>
              </span>
            )}
          </>
        );
        return it.onClick ? (
          <button key={it.label} type="button" className={cls} onClick={it.onClick} aria-pressed={it.active}>
            {inner}
          </button>
        ) : (
          <div key={it.label} className={cls}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

/** Common icon paths for page KPIs. */
export const KPI_ICONS = {
  orders: "M6 6h15l-1.5 8H8L6 3H3M9 20a1.6 1.6 0 100-3.2A1.6 1.6 0 009 20zm9 0a1.6 1.6 0 100-3.2A1.6 1.6 0 0018 20z",
  box: "M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
  truck: "M1 7h13v10H1zM14 10h4l3 3v4h-7zM6 20a1.7 1.7 0 100-3.4A1.7 1.7 0 006 20zm11 0a1.7 1.7 0 100-3.4A1.7 1.7 0 0017 20z",
  check: "M9 12l2 2 4-5M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7z",
  tag: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  people: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1.5-4 5-6 8-6s6.5 2 8 6",
  money: "M3 17l5-6 4 3 5-7 4 5M3 21h18",
  chat: "M21 11.5a8.4 8.4 0 01-9 8.4 8.6 8.6 0 01-3.9-.9L3 21l2-4.9a8.4 8.4 0 1116-4.6z",
  warn: "M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  calendar: "M8 2v4M16 2v4M3 9h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z",
} as const;
