// Shared, typed client for the Nethrasap FastAPI backend.
// Types are generated from the live OpenAPI schema — run `npm run generate`
// (backend must be up) whenever backend endpoints change. CI regenerates and
// fails on drift, so frontend types can never silently diverge from the API.

export const API_PREFIX = "/api/v1";

export interface ApiClientOptions {
  /** Absolute base URL (prod) or "" for same-origin/proxied dev. */
  baseUrl?: string;
  /** Returns the current access token, if any. */
  getToken?: () => string | null | Promise<string | null>;
  /** Called on 401 after a failed refresh — e.g. redirect to /login. */
  onUnauthorized?: () => void;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API ${status}`);
  }
}

export function createApiClient(opts: ApiClientOptions = {}) {
  const base = (opts.baseUrl ?? "") + API_PREFIX;

  async function request<T>(
    method: string,
    path: string,
    init?: { body?: unknown; query?: Record<string, string | number | boolean | undefined> },
  ): Promise<T> {
    const url = new URL(base + path, typeof window === "undefined" ? "http://localhost" : window.location.origin);
    for (const [k, v] of Object.entries(init?.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    const token = await opts.getToken?.();
    const res = await fetch(opts.baseUrl ? url.toString() : url.pathname + url.search, {
      method,
      credentials: "include",
      headers: {
        ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    if (res.status === 401) opts.onUnauthorized?.();
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  }

  return {
    get: <T>(path: string, query?: Record<string, string | number | boolean | undefined>) =>
      request<T>("GET", path, { query }),
    post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body }),
    patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
    del: <T>(path: string) => request<T>("DELETE", path),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
