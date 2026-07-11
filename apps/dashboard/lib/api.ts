import { createApiClient } from "@nethrasap/api-client";

let accessToken: string | null = null;
export function setAccessToken(t: string | null) {
  accessToken = t;
}
let onUnauthorizedCb: (() => void) | null = null;
export function setOnUnauthorized(cb: () => void) {
  onUnauthorizedCb = cb;
}

// Absolute API base for the browser. Set NEXT_PUBLIC_API_BASE in production so
// the dashboard calls the API directly; empty in local dev (Next proxies).
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";
export const WS_BASE = API_BASE ? API_BASE.replace(/^http/, "ws") : "";

export const api = createApiClient({
  baseUrl: API_BASE,
  getToken: () => accessToken,
  onUnauthorized: () => onUnauthorizedCb?.(),
});
