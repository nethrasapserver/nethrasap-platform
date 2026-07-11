import { createApiClient } from "@nethrasap/api-client";

// In-memory access token (kept out of localStorage to reduce XSS blast radius).
// The refresh token lives in an httpOnly cookie the backend sets; on load we
// call /auth/refresh to bootstrap a fresh access token.
let accessToken: string | null = null;

export function setAccessToken(t: string | null) {
  accessToken = t;
}
export function getAccessToken() {
  return accessToken;
}

let onUnauthorizedCb: (() => void) | null = null;
export function setOnUnauthorized(cb: () => void) {
  onUnauthorizedCb = cb;
}

// Absolute API base for the browser. When NEXT_PUBLIC_API_BASE is set (prod),
// the browser calls the API directly (needed for WebSockets + cross-origin);
// when empty (local dev), same-origin "/api/v1/*" is proxied by Next rewrites.
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";
export const WS_BASE = API_BASE ? API_BASE.replace(/^http/, "ws") : "";

/** Browser client. */
export const api = createApiClient({
  baseUrl: API_BASE,
  getToken: () => accessToken,
  onUnauthorized: () => onUnauthorizedCb?.(),
});

/** Server client for SSR reads (public catalogue). Talks to the backend
 *  directly so server components can prerender. Uses the internal proxy
 *  target if set, else the public API base, else localhost for dev. */
export function serverApi() {
  const base =
    process.env.API_PROXY_TARGET ?? process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
  return createApiClient({ baseUrl: base });
}
