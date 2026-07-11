"use client";

import type { MeResponse, TokenPair } from "@nethrasap/api-client";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const refreshToken = useRef<string | null>(null);

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
      setAccessToken(t.access_token);
      refreshToken.current = t.refresh_token;
      try {
        localStorage.setItem("nethra.rt", t.refresh_token);
      } catch {
        /* ignore */
      }
      await loadMe();
    },
    [loadMe],
  );

  const refresh = useCallback(async () => {
    const rt = refreshToken.current ?? localStorage.getItem("nethra.rt");
    if (!rt) {
      setLoading(false);
      return;
    }
    try {
      const t = await api.post<TokenPair>("/auth/refresh", { refresh_token: rt });
      await setSession(t);
    } catch {
      setAccessToken(null);
      localStorage.removeItem("nethra.rt");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [setSession]);

  const logout = useCallback(async () => {
    const rt = refreshToken.current ?? localStorage.getItem("nethra.rt");
    try {
      if (rt) await api.post("/auth/logout", { refresh_token: rt });
    } catch {
      /* ignore */
    }
    setAccessToken(null);
    refreshToken.current = null;
    localStorage.removeItem("nethra.rt");
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
