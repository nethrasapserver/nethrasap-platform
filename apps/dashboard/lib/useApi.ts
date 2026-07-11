"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

/** Simple GET hook with loading/error/refetch. Waits until enabled. */
export function useApi<T>(path: string | null, query?: Record<string, string | number | boolean | undefined>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const key = path === null ? null : path + JSON.stringify(query ?? {});

  const refetch = useCallback(async () => {
    if (path === null) return;
    setLoading(true);
    setError(false);
    try {
      setData(await api.get<T>(path, query));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
