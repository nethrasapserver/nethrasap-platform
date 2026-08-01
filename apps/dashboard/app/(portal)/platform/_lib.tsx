"use client";

import { ApiError } from "@nethrasap/api-client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * Platform-Ops fetch hook. Unlike the shared useApi, it separates a 403
 * (permission wall — render access-denied, never zeros: H-13) from a generic
 * failure, and exposes setData so views can update optimistically. All
 * /platform endpoints require the platform:admin permission upstream.
 */
export function usePlatformApi<T>(
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [failed, setFailed] = useState(false);

  const key = path + JSON.stringify(query ?? {});

  const refetch = useCallback(async () => {
    setLoading(true);
    setForbidden(false);
    setFailed(false);
    try {
      setData(await api.get<T>(path, query));
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setForbidden(true);
      else setFailed(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, forbidden, failed, refetch, setData };
}

const centered: React.CSSProperties = {
  marginTop: 16,
  display: "grid",
  gap: 8,
  justifyItems: "center",
  textAlign: "center",
  padding: "40px 20px",
};

/** Permission wall — the API returned 403. Never shown as zeros. */
export function AccessDenied() {
  return (
    <div className="card empty" style={centered}>
      <strong>You don&apos;t have access to Platform Ops</strong>
      <span className="muted small">
        This console needs the platform admin permission. Ask an owner if you need it.
      </span>
    </div>
  );
}

/** Generic load failure with a retry. */
export function ErrorCard({ onRetry, what }: { onRetry: () => void; what: string }) {
  return (
    <div className="card empty" style={{ ...centered, gap: 12 }}>
      <span>Could not load {what}.</span>
      <button className="btn btn-outline btn-sm" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

/** Neutral empty state. */
export function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="card empty" style={centered}>
      <span className="muted">{children}</span>
    </div>
  );
}
