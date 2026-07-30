import { createApiClient } from "@nethrasap/api-client";

let accessToken: string | null = null;
export function setAccessToken(t: string | null) {
  accessToken = t;
}
let onUnauthorizedCb: (() => void) | null = null;
export function setOnUnauthorized(cb: () => void) {
  onUnauthorizedCb = cb;
}

// In the browser the API is always same-origin "/api/v1" — next.config.mjs
// rewrites it to the backend. Same-origin is required so the httpOnly
// `nethra_rt` refresh cookie is sent with requests. NEXT_PUBLIC_API_BASE is
// only used server-side (and for WS, which needs an absolute origin).
const PUBLIC_API = process.env.NEXT_PUBLIC_API_BASE ?? "";
export const API_BASE = typeof window === "undefined" ? PUBLIC_API : "";
export const WS_BASE = PUBLIC_API ? PUBLIC_API.replace(/^http/, "ws") : "";

export const api = createApiClient({
  baseUrl: API_BASE,
  getToken: () => accessToken,
  onUnauthorized: () => onUnauthorizedCb?.(),
  // Keep the module-level token cache in sync when the client refreshes the
  // access token itself (single-flight 401 → refresh → retry). Tolerant of
  // either callback shape (raw token string or a TokenPair).
  onTokenRefreshed: (t: unknown) => {
    if (typeof t === "string") setAccessToken(t);
    else if (t && typeof t === "object" && "access_token" in t)
      setAccessToken((t as { access_token: string }).access_token);
  },
});
