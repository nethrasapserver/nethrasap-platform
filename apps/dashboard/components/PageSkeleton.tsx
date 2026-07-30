/**
 * Route-transition skeleton: page title + KPI row + table shimmer.
 * Shape mirrors the dashboard home so the swap-in is low-jank. The `.skeleton`
 * shimmer comes from @nethrasap/ui/styles.css, which already freezes all
 * animation under prefers-reduced-motion.
 */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading page" style={{ display: "grid", gap: 20 }}>
      {/* Visually hidden label — no sr-only utility in the design system yet. */}
      <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>
        Loading…
      </span>

      {/* Page head */}
      <div aria-hidden="true" className="row spread">
        <div className="skeleton" style={{ height: 28, width: 200 }} />
        <div className="skeleton" style={{ height: 32, width: 140, borderRadius: 999 }} />
      </div>

      {/* KPI row */}
      <div aria-hidden="true" className="kpi-row">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton" style={{ height: 110, borderRadius: "var(--r-lg)" }} />
        ))}
      </div>

      {/* Table */}
      <div aria-hidden="true" className="card">
        <div className="panel-body" style={{ display: "grid", gap: 14 }}>
          <div className="skeleton" style={{ height: 14, width: "35%" }} />
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 20 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
