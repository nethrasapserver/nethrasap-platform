// Shared, typed client for the Nethrasap FastAPI backend.
// Types are generated from the live OpenAPI schema — run `npm run generate`
// (backend must be up) whenever backend endpoints change. CI regenerates and
// fails on drift, so frontend types can never silently diverge from the API.

import type { components } from "./schema";

export type Schemas = components["schemas"];
export type { paths, components } from "./schema";

// Convenience aliases for the schemas the frontends touch most.
export type TokenPair = Schemas["TokenPair"];
export type MeResponse = Schemas["MeResponse"];
export type ProductListItem = Schemas["ProductListItem"];
export type ProductDetail = Schemas["ProductDetail"];
export type CategoryItem = Schemas["CategoryItem"];
export type CartOut = Schemas["CartOut"];
export type OrderDetail = Schemas["OrderDetail"];
export type OrderListItem = Schemas["OrderListItem"];

export const API_PREFIX = "/api/v1";

export interface ApiClientOptions {
  /** Absolute base URL (prod) or "" for same-origin/proxied dev. */
  baseUrl?: string;
  /** Returns the current access token, if any. */
  getToken?: () => string | null | Promise<string | null>;
  /**
   * Called when a 401 was transparently recovered via POST /auth/refresh —
   * persist the new access token (e.g. update in-memory auth state). The
   * refresh uses the httpOnly session cookie, so callers that don't wire this
   * up (yet) simply never see a successful cookie refresh and fall through to
   * `onUnauthorized` as before.
   */
  onTokenRefreshed?: (tokens: TokenPair) => void;
  /** Called on 401 after the refresh attempt failed — e.g. redirect to /login. */
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

// Auth endpoints never trigger the transparent-refresh path: a 401 from
// login/signup is a credentials error, and a 401 from refresh/logout must not
// recurse into another refresh.
const AUTH_PATHS = new Set(["/auth/login", "/auth/signup", "/auth/refresh", "/auth/logout"]);

export function createApiClient(opts: ApiClientOptions = {}) {
  const base = (opts.baseUrl ?? "") + API_PREFIX;

  // Single-flight refresh: concurrent 401s share one POST /auth/refresh. The
  // httpOnly `nethra_rt` cookie identifies the session, so the body is empty.
  let refreshInFlight: Promise<TokenPair | null> | null = null;
  function refreshTokens(): Promise<TokenPair | null> {
    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        try {
          const url = new URL(
            base + "/auth/refresh",
            typeof window === "undefined" ? "http://localhost" : window.location.origin,
          );
          const res = await fetch(opts.baseUrl ? url.toString() : url.pathname, {
            method: "POST",
            cache: "no-store",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
          if (!res.ok) return null;
          const tokens = (await res.json().catch(() => null)) as TokenPair | null;
          if (!tokens?.access_token) return null;
          opts.onTokenRefreshed?.(tokens);
          return tokens;
        } catch {
          return null;
        } finally {
          refreshInFlight = null;
        }
      })();
    }
    return refreshInFlight;
  }

  async function request<T>(
    method: string,
    path: string,
    init?: { body?: unknown; query?: Record<string, string | number | boolean | undefined> },
  ): Promise<T> {
    const url = new URL(base + path, typeof window === "undefined" ? "http://localhost" : window.location.origin);
    for (const [k, v] of Object.entries(init?.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    const target = opts.baseUrl ? url.toString() : url.pathname + url.search;
    const body = init?.body !== undefined ? JSON.stringify(init.body) : undefined;
    const doFetch = (token: string | null | undefined) =>
      fetch(target, {
        method,
        // Never let Next's server-side data cache persist API responses —
        // catalogue/orders are live data; an admin edit must show on the next
        // request, not after a container restart.
        cache: "no-store",
        credentials: "include",
        headers: {
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body,
      });

    let res = await doFetch(await opts.getToken?.());
    if (res.status === 401 && !AUTH_PATHS.has(path)) {
      // Access token likely expired: refresh via the session cookie, then
      // retry the original request exactly once with the fresh token.
      const tokens = await refreshTokens();
      if (tokens) res = await doFetch(tokens.access_token);
      if (res.status === 401) opts.onUnauthorized?.();
    }
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  }

  return {
    get: <T>(path: string, query?: Record<string, string | number | boolean | undefined>) =>
      request<T>("GET", path, { query }),
    post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body }),
    put: <T>(path: string, body?: unknown) => request<T>("PUT", path, { body }),
    patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
    del: <T>(path: string) => request<T>("DELETE", path),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** Realtime event envelope as published by the backend hub. */
export interface RealtimeEvent {
  type: string;
  entity: string;
  entity_id: string;
  ts: string;
  payload: Record<string, unknown>;
}

/**
 * Open an authenticated WebSocket to the realtime hub. Trades the caller's
 * bearer token for a one-time ticket, then connects with it. Returns the
 * socket plus a close(). Auto-reconnect is the caller's concern (simple: call
 * again on close).
 */
export async function connectRealtime(opts: {
  api: ApiClient;
  wsBase: string; // e.g. "" for same-origin (ws(s)://host) or "wss://api.example"
  onEvent: (e: RealtimeEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
}): Promise<{ socket: WebSocket; close: () => void }> {
  const { ticket } = await opts.api.post<{ ticket: string; expires_in: number }>(
    "/realtime/ticket",
  );
  const origin =
    opts.wsBase ||
    (typeof window !== "undefined"
      ? window.location.origin.replace(/^http/, "ws")
      : "ws://localhost:8000");
  const socket = new WebSocket(`${origin}${API_PREFIX}/ws?ticket=${encodeURIComponent(ticket)}`);
  socket.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      if (data?.type && data.type !== "hello") opts.onEvent(data as RealtimeEvent);
    } catch {
      /* ignore malformed frames */
    }
  };
  if (opts.onOpen) socket.onopen = opts.onOpen;
  if (opts.onClose) socket.onclose = opts.onClose;
  // Keepalive ping every 30s.
  const ping = setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) socket.send("ping");
  }, 30_000);
  return {
    socket,
    close: () => {
      clearInterval(ping);
      socket.close();
    },
  };
}
