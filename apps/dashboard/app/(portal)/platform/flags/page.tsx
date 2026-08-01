"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { AccessDenied, EmptyCard, ErrorCard, usePlatformApi } from "../_lib";

interface FeatureFlag {
  key: string;
  enabled: boolean;
  description?: string | null;
}

/** Accessible on/off switch built on the design-system tokens. */
function Toggle({
  on,
  busy,
  onChange,
  label,
}: {
  on: boolean;
  busy: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={onChange}
      style={{
        position: "relative",
        width: 44,
        height: 24,
        flex: "none",
        borderRadius: 999,
        border: "1px solid var(--line-2)",
        background: on ? "var(--brand-700)" : "var(--paper-3)",
        cursor: busy ? "not-allowed" : "pointer",
        opacity: busy ? 0.6 : 1,
        transition: "background .15s",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 2,
          left: on ? 22 : 2,
          width: 18,
          height: 18,
          borderRadius: 999,
          background: "#fff",
          boxShadow: "0 1px 2px rgba(0,0,0,.25)",
          transition: "left .15s",
        }}
      />
    </button>
  );
}

export default function FeatureFlagsPage() {
  const { data, loading, forbidden, failed, refetch, setData } = usePlatformApi<FeatureFlag[]>("/platform/feature-flags");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const toast = useToast();

  if (forbidden) return <AccessDenied />;
  if (failed && !data) return <ErrorCard what="feature flags" onRetry={refetch} />;

  const flags = data ?? [];

  async function toggle(flag: FeatureFlag) {
    const next = !flag.enabled;
    setBusyKey(flag.key);
    // Optimistic flip; revert on failure.
    setData((cur) => (cur ?? []).map((f) => (f.key === flag.key ? { ...f, enabled: next } : f)));
    try {
      await api.put(`/platform/feature-flags/${encodeURIComponent(flag.key)}`, { enabled: next });
      toast(`${flag.key} ${next ? "enabled" : "disabled"}`);
    } catch {
      setData((cur) => (cur ?? []).map((f) => (f.key === flag.key ? { ...f, enabled: flag.enabled } : f)));
      toast(`Could not update ${flag.key}`, true);
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {loading && !data && <p className="muted small">Loading flags…</p>}
      {!loading && flags.length === 0 && <EmptyCard>No feature flags defined.</EmptyCard>}

      {flags.map((f) => (
        <div
          key={f.key}
          className="card pad"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}
        >
          <div style={{ minWidth: 0 }}>
            <div className="mono" style={{ fontWeight: 600 }}>
              {f.key}
            </div>
            {f.description && (
              <span className="muted small" style={{ display: "block", marginTop: 2 }}>
                {f.description}
              </span>
            )}
          </div>
          <div className="row" style={{ gap: 10, flex: "none" }}>
            <span className={`pill ${f.enabled ? "pill-ok" : "pill-info"}`}>{f.enabled ? "on" : "off"}</span>
            <Toggle on={f.enabled} busy={busyKey === f.key} onChange={() => toggle(f)} label={`Toggle ${f.key}`} />
          </div>
        </div>
      ))}
    </div>
  );
}
