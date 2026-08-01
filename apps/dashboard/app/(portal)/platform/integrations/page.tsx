"use client";

import { AccessDenied, EmptyCard, ErrorCard, usePlatformApi } from "../_lib";

interface Integration {
  name: string;
  configured: boolean;
  detail?: string | null;
}

export default function IntegrationsPage() {
  const { data, loading, forbidden, failed, refetch } = usePlatformApi<Integration[]>("/platform/integrations");

  if (forbidden) return <AccessDenied />;
  if (failed && !data) return <ErrorCard what="integrations" onRetry={refetch} />;

  const integrations = data ?? [];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {loading && !data && <p className="muted small">Loading integrations…</p>}
      {!loading && integrations.length === 0 && <EmptyCard>No integrations reported.</EmptyCard>}

      {integrations.length > 0 && (
        <div className="kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {integrations.map((it) => (
            <div key={it.name} className="card pad" style={{ display: "grid", gap: 8 }}>
              <div className="row spread">
                <span style={{ fontWeight: 600, textTransform: "capitalize" }}>{it.name}</span>
                <span className={`pill ${it.configured ? "pill-ok" : "pill-out"}`}>
                  {it.configured ? "configured" : "not configured"}
                </span>
              </div>
              <span className="muted small">{it.detail || (it.configured ? "Active" : "Awaiting configuration")}</span>
            </div>
          ))}
        </div>
      )}

      <p className="muted small" style={{ margin: 0 }}>
        Secrets (API keys, tokens) are managed in the cloud secret manager, not here. This view only
        reports whether each integration is wired up and its non-sensitive details.
      </p>
    </div>
  );
}
