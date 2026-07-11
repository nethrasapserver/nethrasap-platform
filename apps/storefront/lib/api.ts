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

/** Browser client — same-origin; Next rewrites /api/v1/* to the backend. */
export const api = createApiClient({
  getToken: () => accessToken,
  onUnauthorized: () => onUnauthorizedCb?.(),
});

/** Server client for SSR reads (public catalogue). Talks to the backend
 *  directly via the internal URL so server components can prerender. */
export function serverApi() {
  const base = process.env.API_PROXY_TARGET ?? "http://localhost:8000";
  return createApiClient({ baseUrl: base });
}
