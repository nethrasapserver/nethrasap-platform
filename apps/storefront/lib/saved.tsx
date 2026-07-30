"use client";

import {
  connectRealtime,
  type Schemas,
} from "@nethrasap/api-client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { WS_BASE, api } from "./api";
import { useAuth } from "./auth";
import { useToast } from "./toast";

// Response shapes of /wishlist and /compare — straight from the generated
// OpenAPI schema now that the endpoints declare response models.
export type SavedItem = Schemas["SavedItemOut"];
export type WishlistOut = Schemas["WishlistOut"];
export type CompareOut = Schemas["CompareOut"];

interface SavedState {
  wishlist: WishlistOut | null;
  compare: CompareOut | null;
  isSaved: (productId: string) => boolean;
  isCompared: (productId: string) => boolean;
  toggleSaved: (productId: string) => Promise<void>;
  toggleCompared: (productId: string) => Promise<void>;
  removeCompared: (productId: string) => Promise<void>;
  clearCompare: () => Promise<void>;
}

const SavedContext = createContext<SavedState | null>(null);

export function SavedProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const [wishlist, setWishlist] = useState<WishlistOut | null>(null);
  const [compare, setCompare] = useState<CompareOut | null>(null);

  const reloadWishlist = useCallback(async () => {
    try {
      setWishlist(await api.get<WishlistOut>("/wishlist"));
    } catch {
      /* transient — WS or the next mutation refreshes it */
    }
  }, []);

  const reloadCompare = useCallback(async () => {
    try {
      setCompare(await api.get<CompareOut>("/compare"));
    } catch {
      /* transient */
    }
  }, []);

  // Load once auth settles; drop state on sign-out.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setWishlist(null);
      setCompare(null);
      return;
    }
    reloadWishlist();
    reloadCompare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, reloadWishlist, reloadCompare]);

  // Realtime cross-device sync: the backend publishes wishlist.updated /
  // compare.updated on the user channel after every mutation — any other
  // open tab or device refetches. Reconnects with a small backoff.
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!user) return;
    let closed = false;
    let handle: { close: () => void } | null = null;

    const connect = () => {
      connectRealtime({
        api,
        wsBase: WS_BASE,
        onEvent: (e) => {
          if (e.entity === "wishlist") reloadWishlist();
          if (e.entity === "compare") reloadCompare();
        },
        onClose: () => {
          if (!closed) retryTimer.current = setTimeout(connect, 5_000);
        },
      })
        .then((h) => {
          if (closed) h.close();
          else handle = h;
        })
        .catch(() => {
          if (!closed) retryTimer.current = setTimeout(connect, 5_000);
        });
    };
    connect();

    return () => {
      closed = true;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      handle?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, reloadWishlist, reloadCompare]);

  const requireUser = useCallback((): boolean => {
    if (user) return true;
    toast("Sign in to save products", true);
    return false;
  }, [user, toast]);

  const isSaved = useCallback(
    (productId: string) => wishlist?.product_ids.includes(productId) ?? false,
    [wishlist],
  );
  const isCompared = useCallback(
    (productId: string) => compare?.product_ids.includes(productId) ?? false,
    [compare],
  );

  const toggleSaved = useCallback(
    async (productId: string) => {
      if (!requireUser()) return;
      const saved = isSaved(productId);
      try {
        const next = saved
          ? await api.del<WishlistOut>(`/wishlist/items/${productId}`)
          : await api.put<WishlistOut>(`/wishlist/items/${productId}`);
        setWishlist(next);
        toast(saved ? "Removed from saved items" : "Saved for later");
      } catch {
        toast("Could not update saved items", true);
      }
    },
    [requireUser, isSaved, toast],
  );

  const toggleCompared = useCallback(
    async (productId: string) => {
      if (!requireUser()) return;
      const inTray = isCompared(productId);
      try {
        const next = inTray
          ? await api.del<CompareOut>(`/compare/items/${productId}`)
          : await api.put<CompareOut>(`/compare/items/${productId}`);
        setCompare(next);
        toast(inTray ? "Removed from compare" : "Added to compare");
      } catch (err: unknown) {
        const status = (err as { status?: number }).status;
        toast(
          status === 409
            ? `Compare is full (${compare?.max_items ?? 4} max) — remove one first`
            : "Could not update compare",
          true,
        );
      }
    },
    [requireUser, isCompared, compare?.max_items, toast],
  );

  const removeCompared = useCallback(
    async (productId: string) => {
      try {
        setCompare(await api.del<CompareOut>(`/compare/items/${productId}`));
      } catch {
        toast("Could not update compare", true);
      }
    },
    [toast],
  );

  const clearCompare = useCallback(async () => {
    try {
      setCompare(await api.del<CompareOut>("/compare"));
    } catch {
      toast("Could not clear compare", true);
    }
  }, [toast]);

  return (
    <SavedContext.Provider
      value={{
        wishlist,
        compare,
        isSaved,
        isCompared,
        toggleSaved,
        toggleCompared,
        removeCompared,
        clearCompare,
      }}
    >
      {children}
    </SavedContext.Provider>
  );
}

export function useSaved() {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error("useSaved within SavedProvider");
  return ctx;
}
