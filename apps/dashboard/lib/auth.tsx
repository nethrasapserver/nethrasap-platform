"use client";

import type { MeResponse, TokenPair } from "@nethrasap/api-client";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, setAccessToken, setOnUnauthorized } from "./api";

const STAFF_ROLES = ["sales", "manager", "admin"];

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
      setAccessToken(t.access_token);
      localStorage.setItem("nethra.dash.rt", t.refresh_token);
      await loadMe();
    },
    [loadMe],
  );

  const logout = useCallback(async () => {
    const rt = localStorage.getItem("nethra.dash.rt");
    try {
      if (rt) await api.post("/auth/logout", { refresh_token: rt });
    } catch {
      /* ignore */
    }
    setAccessToken(null);
    localStorage.removeItem("nethra.dash.rt");
    setUser(null);
    router.push("/login");
  }, [router]);

  const bootstrap = useCallback(async () => {
    const rt = localStorage.getItem("nethra.dash.rt");
    if (!rt) {
      setLoading(false);
      return;
    }
    try {
      const t = await api.post<TokenPair>("/auth/refresh", { refresh_token: rt });
      setAccessToken(t.access_token);
      localStorage.setItem("nethra.dash.rt", t.refresh_token);
      await loadMe();
    } catch {
      setAccessToken(null);
      localStorage.removeItem("nethra.dash.rt");
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

  // Route guard: only staff roles may use the dashboard.
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
