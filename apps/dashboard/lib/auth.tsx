"use client";

import type { MeResponse, TokenPair } from "@nethrasap/api-client";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, setAccessToken, setOnUnauthorized } from "./api";

// Keep in sync with STAFF_ROLES in middleware.ts (edge runtime can't import
// this client module, so the list is duplicated by design).
const STAFF_ROLES = ["sales", "manager", "admin"];

// Pre-cookie-auth builds persisted the refresh token here. Read once for
// migration, then delete — the refresh token now lives only in the httpOnly
// `nethra_rt` cookie the backend sets.
const LEGACY_RT_KEY = "nethra.dash.rt";

interface AuthState {
  user: MeResponse | null;
  loading: boolean;
  can: (perm: string) => boolean;
  login: (t: TokenPair) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function permMatches(granted: string[], needed: string): boolean {
  if (granted.includes("*") || granted.includes(needed)) return true;
  const resource = needed.split(":")[0];
  return granted.includes(`${resource}:*`);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const loadMe = useCallback(async () => {
    const me = await api.get<MeResponse>("/auth/me");
    setUser(me);
    return me;
  }, []);

  const login = useCallback(
    async (t: TokenPair) => {
      // The login response also set the httpOnly `nethra_rt` cookie; only the
      // short-lived access token is kept, in memory.
      setAccessToken(t.access_token);
      await loadMe();
    },
    [loadMe],
  );

  const logout = useCallback(async () => {
    try {
      // Empty JSON body — the backend revokes the refresh token from the
      // `nethra_rt` cookie and clears it.
      await api.post("/auth/logout", {});
    } catch {
      /* ignore */
    }
    setAccessToken(null);
    localStorage.removeItem(LEGACY_RT_KEY); // legacy cleanup, harmless if absent
    setUser(null);
    router.push("/login");
  }, [router]);

  const bootstrap = useCallback(async () => {
    // One-time migration: consume a legacy localStorage refresh token if one
    // exists, then delete it. Otherwise refresh purely off the cookie.
    const legacyRt = localStorage.getItem(LEGACY_RT_KEY);
    if (legacyRt) localStorage.removeItem(LEGACY_RT_KEY);

    // `nethra_auth` is the readable role-hint cookie set alongside the
    // httpOnly refresh cookie — if neither it nor a legacy token exists,
    // skip the doomed refresh call (e.g. first visit to /login).
    const hasSession = document.cookie.split("; ").some((c) => c.startsWith("nethra_auth="));
    if (!legacyRt && !hasSession) {
      setLoading(false);
      return;
    }
    try {
      const t = await api.post<TokenPair>(
        "/auth/refresh",
        legacyRt ? { refresh_token: legacyRt } : {},
      );
      setAccessToken(t.access_token);
      await loadMe();
    } catch {
      setAccessToken(null);
    } finally {
      setLoading(false);
    }
  }, [loadMe]);

  useEffect(() => {
    setOnUnauthorized(() => {
      setAccessToken(null);
      setUser(null);
    });
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route guard: only staff roles may use the dashboard. middleware.ts already
  // gates on the `nethra_auth` cookie before the bundle is served; this client
  // gate stays as the in-app source of truth (real /auth/me role, token expiry
  // mid-session) and keeps the no-flash behaviour.
  useEffect(() => {
    if (loading) return;
    const onLogin = pathname === "/login";
    if (!user && !onLogin) router.replace("/login");
    if (user && !STAFF_ROLES.includes(user.role)) {
      // A customer somehow reached the dashboard.
      logout();
    }
    if (user && onLogin) router.replace("/");
  }, [loading, user, pathname, router, logout]);

  const can = useCallback(
    (perm: string) => (user ? permMatches(user.permissions ?? [], perm) : false),
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, loading, can, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth within AuthProvider");
  return ctx;
}
