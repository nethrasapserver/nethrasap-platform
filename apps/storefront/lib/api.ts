import { createApiClient } from "@nethrasap/api-client";

// In-memory access token (kept out of localStorage to reduce XSS blast radius).
// The refresh token lives ONLY in the httpOnly `nethra_rt` cookie the backend
// sets (path=/api/v1/auth); on load, AuthProvider POSTs /auth/refresh with an
// empty body — the cookie identifies the session — to bootstrap a fresh
// access token. Nothing auth-related is persisted in web storage.
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

// Absolute API origin, when configured (prod). Browser REST calls always go
// same-origin ("/api/v1/*") regardless, so the httpOnly refresh cookie is
// first-party — the Next rewrite proxies them to the backend. WebSockets
// cannot go through the rewrite, so WS_BASE stays absolute: derived from
// NEXT_PUBLIC_API_BASE when set, else (dev only) the page host on the
// backend's port 8000, else "" — connectRealtime falls back to the page
// origin, for deployments where the API is served behind the same host.
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";
export const WS_BASE = API_BASE
  ? API_BASE.replace(/^http/, "ws")
  : typeof window !== "undefined" && process.env.NODE_ENV === "development"
    ? `ws://${window.location.hostname}:8000`
    : "";

/** Browser client. Same-origin via the Next rewrite so the `nethra_rt`
 *  cookie rides along; expired access tokens are refreshed transparently
 *  (single-flight) and updated in memory via onTokenRefreshed. */
export const api = createApiClient({
  baseUrl: "",
  getToken: () => accessToken,
  onTokenRefreshed: (t) => setAccessToken(t.access_token),
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
