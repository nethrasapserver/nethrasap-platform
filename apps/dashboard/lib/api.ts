import { createApiClient } from "@nethrasap/api-client";

let accessToken: string | null = null;
export function setAccessToken(t: string | null) {
  accessToken = t;
}
let onUnauthorizedCb: (() => void) | null = null;
export function setOnUnauthorized(cb: () => void) {
  onUnauthorizedCb = cb;
}

export const api = createApiClient({
  getToken: () => accessToken,
  onUnauthorized: () => onUnauthorizedCb?.(),
});
