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
