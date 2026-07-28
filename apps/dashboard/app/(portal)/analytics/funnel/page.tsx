"use client";

import { inr } from "@/lib/format";
import { useApi } from "@/lib/useApi";

interface Enquiry {
  id: string;
  reference: string;
  status: string;
  quoted_total: number | null;
  approval_status: string;
  created_at: string;
  items: { product_name: string; quantity: number }[];
}

/** RFQ funnel — how enquiries move from request to converted order. */
export default function FunnelAnalytics() {
  const { data, loading } = useApi<Enquiry[]>("/admin/enquiries");
  const all = data ?? [];
  const by = (s: string) => all.filter((e) => e.status === s).length;

  const stages = [
    { key: "submitted", label: "Submitted", value: all.length, color: "var(--ice-600, #2b6b7f)" },
    { key: "quoted", label: "Quoted", value: by("quoted") + by("confirmed") + by("converted"), color: "var(--clay)" },
    { key: "confirmed", label: "Accepted by customer", value: by("confirmed") + by("converted"), color: "var(--copper)" },
    { key: "converted", label: "Converted to orders", value: by("converted"), color: "var(--brand-600)" },
  ];
  const max = Math.max(1, all.length);
  const conversion = all.length ? Math.round((by("converted") / all.length) * 100) : 0;
  const quotedValue = all
    .filter((e) => e.quoted_total != null && ["quoted", "confirmed"].includes(e.status))
    .reduce((n, e) => n + (e.quoted_total ?? 0), 0);
  const wonValue = all
    .filter((e) => e.status === "converted" && e.quoted_total != null)
    .reduce((n, e) => n + (e.quoted_total ?? 0), 0);

  return (
    <div className="bento" style={{ marginTop: 4 }}>
      <div className="tile">
        <h3>Enquiries</h3>
        <div className="big">{loading ? "…" : all.length}</div>
        <span className="muted small">all time</span>
      </div>
      <div className="tile">
        <h3>Conversion rate</h3>
        <div className="big">{loading ? "…" : `${conversion}%`}</div>
        <span className="muted small">submitted → order</span>
      </div>
      <div className="tile">
        <h3>Open quoted value</h3>
        <div className="big">{loading ? "…" : inr(quotedValue)}</div>
        <span className="muted small">quoted or accepted, not yet orders</span>
      </div>
      <div className="tile">
        <h3>Won via RFQ</h3>
        <div className="big">{loading ? "…" : inr(wonValue)}</div>
        <span className="muted small">quoted value converted to orders</span>
      </div>

      <div className="tile b4">
        <h3>The funnel</h3>
        <div style={{ display: "grid", gap: 6 }}>
          {stages.map((s, i) => {
            const pct = Math.round((s.value / max) * 100);
            const prev = i > 0 ? stages[i - 1].value : null;
            const carried = prev ? Math.round((s.value / Math.max(1, prev)) * 100) : null;
            return (
              <div key={s.key} style={{ textAlign: "center" }} title={`${s.label}: ${s.value}`}>
                <div
                  style={{
                    width: `${Math.max(16, pct)}%`,
                    margin: "0 auto",
                    background: s.color,
                    color: "#fff",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: ".84rem",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    transition: "width .25s ease",
                  }}
                >
                  {s.label} · {s.value}
                </div>
                {carried != null && (
                  <div className="muted" style={{ fontSize: ".68rem", margin: "2px 0" }}>{carried}% carried through</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="tile b2">
        <h3>Needs attention</h3>
        <dl className="drawer-dl">
          <dt>Pending a quote</dt>
          <dd className="mono">{by("pending")}</dd>
          <dt>Awaiting internal approval</dt>
          <dd className="mono">{all.filter((e) => e.approval_status === "pending").length}</dd>
          <dt>Returned to sales</dt>
          <dd className="mono">{all.filter((e) => e.approval_status === "returned").length}</dd>
          <dt>Rejected</dt>
          <dd className="mono">{by("rejected")}</dd>
        </dl>
      </div>
      <div className="tile b2">
        <h3>Latest enquiries</h3>
        <div style={{ display: "grid", gap: 8 }}>
          {all.slice(0, 6).map((e) => (
            <div key={e.id} className="row spread small">
              <span>
                <b className="mono">{e.reference}</b>{" "}
                <span className="muted">{e.items.length} item{e.items.length === 1 ? "" : "s"}</span>
              </span>
              <span className="mono">{e.quoted_total != null ? inr(e.quoted_total) : "—"}</span>
            </div>
          ))}
          {!loading && all.length === 0 && <p className="muted small" style={{ margin: 0 }}>No enquiries yet.</p>}
        </div>
      </div>
    </div>
  );
}
