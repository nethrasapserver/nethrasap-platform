"use client";

import type { MeResponse, TokenPair } from "@nethrasap/api-client";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, setAccessToken, setOnUnauthorized } from "./api";

interface AuthState {
  user: MeResponse | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setSession: (t: TokenPair) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** One-time migration: pre-cookie sessions kept the refresh token in
 *  localStorage under "nethra.rt". Consume it for a single body-based refresh
 *  and remove it — the backend rotates the session into the httpOnly
 *  `nethra_rt` cookie on that response, and we never persist it again. */
function takeLegacyRefreshToken(): string | null {
  try {
    const rt = localStorage.getItem("nethra.rt");
    if (rt !== null) localStorage.removeItem("nethra.rt");
    return rt;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadMe = useCallback(async () => {
    try {
      const me = await api.get<MeResponse>("/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  const setSession = useCallback(
    async (t: TokenPair) => {
      // Access token stays in memory only; the refresh token was set by the
      // backend as an httpOnly cookie on this same response.
      setAccessToken(t.access_token);
      await loadMe();
    },
    [loadMe],
  );

  const refresh = useCallback(async () => {
    const legacyRt = takeLegacyRefreshToken();
    try {
      // Empty body: the httpOnly `nethra_rt` cookie identifies the session.
      // A legacy localStorage token (old sessions) is sent once, then gone.
      const t = await api.post<TokenPair>(
        "/auth/refresh",
        legacyRt !== null ? { refresh_token: legacyRt } : {},
      );
      await setSession(t);
    } catch {
      setAccessToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [setSession]);

  const logout = useCallback(async () => {
    try {
      // The cookie identifies the session; the backend clears both auth
      // cookies in the response.
      await api.post("/auth/logout", {});
    } catch {
      /* ignore */
    }
    setAccessToken(null);
    setUser(null);
    router.push("/");
  }, [router]);

  useEffect(() => {
    setOnUnauthorized(() => {
      setAccessToken(null);
      setUser(null);
    });
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, setSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
