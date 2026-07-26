"use client";

import type { CartOut } from "@nethrasap/api-client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import { useToast } from "./toast";

interface CartState {
  cart: CartOut | null;
  count: number;
  reload: () => Promise<void>;
  add: (variantId: string, quantity?: number) => Promise<void>;
  update: (itemId: string, quantity: number) => Promise<void>;
  remove: (itemId: string) => Promise<void>;
  /** Quantity of a variant in the cart (0 if absent) — drives card steppers. */
  qtyForVariant: (variantId: string) => number;
  incVariant: (variantId: string) => Promise<void>;
  decVariant: (variantId: string) => Promise<void>;
}

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartOut | null>(null);
  const toast = useToast();
  const { user, loading: authLoading } = useAuth();

  const reload = useCallback(async () => {
    try {
      setCart(await api.get<CartOut>("/cart"));
    } catch {
      /* anonymous cart cookie is set on first GET; ignore transient errors */
    }
  }, []);

  const add = useCallback(
    async (variantId: string, quantity = 1) => {
      try {
        const c = await api.post<CartOut>("/cart/items", { variant_id: variantId, quantity });
        setCart(c);
        toast("Added to cart");
      } catch {
        toast("Could not add to cart", true);
      }
    },
    [toast],
  );

  const update = useCallback(async (itemId: string, quantity: number) => {
    const c = await api.patch<CartOut>(`/cart/items/${itemId}`, { quantity });
    setCart(c);
  }, []);

  const remove = useCallback(async (itemId: string) => {
    const c = await api.del<CartOut>(`/cart/items/${itemId}`);
    setCart(c);
  }, []);

  // Reload once auth has settled (and again whenever the signed-in user
  // changes) so we always read the correct cart — the user's when logged in,
  // the anonymous cookie cart otherwise. Reloading before the access token is
  // set would read the wrong cart.
  useEffect(() => {
    if (!authLoading) reload();
  }, [authLoading, user?.id, reload]);

  const count = cart?.items?.reduce((n, i) => n + (i.quantity ?? 0), 0) ?? 0;

  const byVariant = useMemo(() => {
    const m = new Map<string, NonNullable<CartOut["items"]>[number]>();
    for (const it of cart?.items ?? []) m.set(it.variant_id, it);
    return m;
  }, [cart]);

  const qtyForVariant = useCallback(
    (variantId: string) => byVariant.get(variantId)?.quantity ?? 0,
    [byVariant],
  );

  const incVariant = useCallback(
    async (variantId: string) => {
      const it = byVariant.get(variantId);
      if (!it) return add(variantId, 1);
      try {
        await update(it.id, it.quantity + 1);
      } catch {
        toast("Could not update quantity", true);
      }
    },
    [byVariant, add, update, toast],
  );

  const decVariant = useCallback(
    async (variantId: string) => {
      const it = byVariant.get(variantId);
      if (!it) return;
      try {
        if (it.quantity <= 1) await remove(it.id);
        else await update(it.id, it.quantity - 1);
      } catch {
        toast("Could not update quantity", true);
      }
    },
    [byVariant, update, remove, toast],
  );

  return (
    <CartContext.Provider
      value={{ cart, count, reload, add, update, remove, qtyForVariant, incVariant, decVariant }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart within CartProvider");
  return ctx;
}
