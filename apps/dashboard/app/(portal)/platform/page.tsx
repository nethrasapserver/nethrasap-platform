"use client";

import { useEffect, useState } from "react";
import { KPI_ICONS, KpiRow } from "@/components/Kpi";
import { dateTime } from "@/lib/format";
import { AccessDenied, ErrorCard, usePlatformApi } from "./_lib";

// Backend contract (schema.d.ts won't have these until api-types regen), so
// every field is optional and defensively read.
interface PlatformStatus {
  services?: { database?: string | boolean; redis?: string | boolean; worker?: string | boolean };
  queue?: { pending?: number; failed?: number; dispatched?: number };
  worker?: { last_heartbeat?: string | null; stale?: boolean };
  version?: string;
  git_sha?: string;
}

const POLL_MS = 15_000;

/** A service is healthy when the backend reports ok / up / true. */
function isUp(v: string | boolean | undefined): boolean {
  return v === true || v === "ok" || v === "up" || v === "healthy" || v === "connected";
}

function HealthChip({ name, value }: { name: string; value: string | boolean | undefined }) {
  const up = isUp(value);
  const known = value !== undefined && value !== null;
  return (
    <div
      className="card pad"
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
    >
      <span style={{ fontWeight: 600, textTransform: "capitalize" }}>{name}</span>
      <span className={`pill ${!known ? "pill-info" : up ? "pill-ok" : "pill-out"}`}>
        <span
          aria-hidden="true"
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            background: "currentColor",
            display: "inline-block",
          }}
        />
        {!known ? "unknown" : up ? "operational" : "down"}
      </span>
    </div>
  );
}

/** Seconds since a heartbeat ISO timestamp, or null if absent. */
function agoSeconds(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((now - t) / 1000));
}

export default function PlatformStatusPage() {
  const { data, loading, forbidden, failed, refetch } = usePlatformApi<PlatformStatus>("/platform/status");
  const [now, setNow] = useState(() => Date.now());

  // Poll ~15s so the console reads live, and tick a local clock every second so
  // the "Xs ago" heartbeat label counts up between polls.
  useEffect(() => {
    const poll = setInterval(refetch, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [refetch]);

  if (forbidden) return <AccessDenied />;
  if (failed && !data) return <ErrorCard what="platform status" onRetry={refetch} />;

  const s = data;
  const services = s?.services ?? {};
  const queue = s?.queue ?? {};
  const hbSecs = agoSeconds(s?.worker?.last_heartbeat, now);
  const stale = s?.worker?.stale === true;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="row spread">
        <span className="muted small">
          {loading && !data ? "Loading…" : `Live · auto-refreshes every ${POLL_MS / 1000}s`}
        </span>
        <button className="btn btn-outline btn-sm" onClick={refetch} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Services
        </div>
        <div className="kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <HealthChip name="database" value={services.database} />
          <HealthChip name="redis" value={services.redis} />
          <HealthChip name="worker" value={services.worker} />
        </div>
      </div>

      <div className="card pad" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600 }}>Worker heartbeat</div>
          <span className="muted small">
            {s?.worker?.last_heartbeat ? `Last beat ${dateTime(s.worker.last_heartbeat)}` : "No heartbeat recorded"}
          </span>
        </div>
        <span className={`pill ${stale ? "pill-out" : hbSecs != null ? "pill-ok" : "pill-info"}`}>
          {stale ? "STALE" : hbSecs != null ? `${hbSecs}s ago` : "unknown"}
        </span>
      </div>

      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Outbox queue
        </div>
        <KpiRow
          items={[
            { label: "Pending", value: queue.pending ?? "—", sub: "waiting to dispatch", icon: KPI_ICONS.chat, tone: "info" },
            { label: "Dispatched", value: queue.dispatched ?? "—", sub: "delivered downstream", icon: KPI_ICONS.check, tone: "ok" },
            { label: "Failed", value: queue.failed ?? "—", sub: "need attention", icon: KPI_ICONS.warn, tone: (queue.failed ?? 0) > 0 ? "danger" : "brand" },
          ]}
        />
      </div>

      <div className="card pad">
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Build
        </div>
        <dl className="drawer-dl" style={{ margin: 0 }}>
          <dt>Version</dt>
          <dd className="mono">{s?.version ?? "—"}</dd>
          <dt>Git SHA</dt>
          <dd className="mono">{s?.git_sha ? s.git_sha.slice(0, 12) : "—"}</dd>
        </dl>
      </div>
    </div>
  );
}
