"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { inr } from "@/lib/format";
import { useToast } from "@/lib/toast";

function Qty({ id, quantity, update, remove }: { id: string; quantity: number; update: (id: string, q: number) => Promise<void>; remove: (id: string) => Promise<void> }) {
  return (
    <span className="stepper">
      <button type="button" aria-label="Decrease quantity"
        onClick={() => (quantity <= 1 ? remove(id) : update(id, quantity - 1))}>−</button>
      <b>{quantity}</b>
      <button type="button" aria-label="Increase quantity" onClick={() => update(id, quantity + 1)}>+</button>
    </span>
  );
}

export default function CartPage() {
  const { cart, update, remove, reload } = useCart();
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [requesting, setRequesting] = useState(false);

  const items = cart?.items ?? [];
  const payable = items.filter((it) => !it.is_quote_only);
  const quoteItems = items.filter((it) => it.is_quote_only);

  if (items.length === 0) {
    return (
      <div className="container section">
        <h2>Your cart</h2>
        <div className="card pad muted" style={{ marginTop: 16 }}>
          Your cart is empty. <Link href="/products">Browse products →</Link>
        </div>
      </div>
    );
  }

  async function requestQuote() {
    if (!user) {
      router.push("/login");
      return;
    }
    setRequesting(true);
    try {
      const enq = await api.post<{ id: string; reference: string }>("/enquiries", {
        items: quoteItems.map((it) => ({ variant_id: it.variant_id, quantity: it.quantity })),
        note: note.trim() || null,
      });
      // The enquiry now owns these lines — clear them from the cart.
      await Promise.all(quoteItems.map((it) => remove(it.id)));
      await reload();
      toast(`Quote request ${enq.reference} sent`);
      router.push(`/enquiries/${enq.id}`);
    } catch {
      toast("Could not send the quote request", true);
      setRequesting(false);
    }
  }

  return (
    <div className="container section">
      <h2>Your cart</h2>

      <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
        {payable.length > 0 && (
          <div className="card pad">
            <div className="cart-list">
              {payable.map((it) => (
                <div key={it.id} className="cart-row">
                  <CartThumb item={it} />
                  <div className="cart-info">
                    <div className="cart-name">{it.product?.name}</div>
                    <div className="muted small">{it.product?.unit_label ?? ""}</div>
                    <div className="muted small">{inr(it.unit_price)} each</div>
                  </div>
                  <Qty id={it.id} quantity={it.quantity} update={update} remove={remove} />
                  <div className="cart-line mono">{inr(it.unit_price * it.quantity)}</div>
                  <button className="btn btn-ghost btn-sm cart-remove" onClick={() => remove(it.id)} aria-label={`Remove ${it.product?.name}`}>✕</button>
                </div>
              ))}
            </div>

            <div className="cart-actions">
              <Link href="/products" className="btn btn-outline">Continue shopping</Link>
              <Link href="/checkout" className="btn btn-primary">
                Proceed to checkout →
              </Link>
            </div>
          </div>
        )}

        {quoteItems.length > 0 && (
          <div className="card">
            <div className="panel-head">
              <h3>Quote request</h3>
              <span className="eyebrow">priced by our team</span>
            </div>
            <div className="cart-list pad">
              {quoteItems.map((it) => (
                <div key={it.id} className="cart-row">
                  <CartThumb item={it} />
                  <div className="cart-info">
                    <div className="cart-name">{it.product?.name}</div>
                    <div className="muted small">Price on quote</div>
                  </div>
                  <Qty id={it.id} quantity={it.quantity} update={update} remove={remove} />
                  <span className="pill pill-info cart-line">Quote</span>
                  <button className="btn btn-ghost btn-sm cart-remove" onClick={() => remove(it.id)} aria-label={`Remove ${it.product?.name}`}>✕</button>
                </div>
              ))}
            </div>
            <div className="pad" style={{ borderTop: "1px solid var(--line)", display: "grid", gap: 10 }}>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="q-note">Anything the sales team should know? (optional)</label>
                <textarea id="q-note" className="input" rows={2} maxLength={1000} value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Monthly requirement, delivery constraints, target price…" />
              </div>
              <button className="btn btn-primary" disabled={requesting} onClick={requestQuote}>
                {requesting ? "Sending…" : user ? `Request a quote for ${quoteItems.length} item${quoteItems.length === 1 ? "" : "s"}` : "Sign in to request a quote"}
              </button>
              <p className="small muted" style={{ margin: 0 }}>
                A sales rep replies with a firm price — you can accept it or negotiate before anything is charged.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CartThumb({ item }: { item: { product?: { name?: string; image_storage_key?: string | null } } }) {
  const src = item.product?.image_storage_key;
  return (
    <div className="cart-thumb">
      {src ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={src} alt={item.product?.name ?? ""} loading="lazy" />
      ) : (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <path d="M4 7h16M6 7v12a2 2 0 002 2h8a2 2 0 002-2V7M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
        </svg>
      )}
    </div>
  );
}
