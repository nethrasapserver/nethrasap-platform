"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { inr } from "@/lib/format";
import { useToast } from "@/lib/toast";

interface PlaceResponse {
  order_number: string;
  status: string;
  payment_status: string;
  gateway?: { gateway: string; gateway_order_id: string; gateway_key_id: string | null; amount: number } | null;
}

export default function CheckoutPage() {
  const { user, loading } = useAuth();
  const { cart, reload } = useCart();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<"cod" | "upi">("cod");
  const [addr, setAddr] = useState({
    full_name: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
    country: "IN",
  });

  useEffect(() => {
    if (user?.profile?.full_name) setAddr((a) => ({ ...a, full_name: user.profile!.full_name }));
    if (user?.phone) setAddr((a) => ({ ...a, phone: a.phone || user.phone.replace("+91", "") }));
  }, [user]);

  if (!loading && !user) {
    return (
      <div className="container section">
        <div className="card pad">
          Please <Link href="/login">sign in</Link> to check out.
        </div>
      </div>
    );
  }

  const items = cart?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="container section">
        <div className="card pad muted">
          Your cart is empty. <Link href="/products">Browse products →</Link>
        </div>
      </div>
    );
  }

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post<PlaceResponse>("/checkout/place", {
        address: addr,
        payment_method: method,
        client_request_id: crypto.randomUUID(),
      });

      if (method === "upi" && res.gateway) {
        if (!res.gateway.gateway_key_id) {
          toast("Online payment isn't configured yet — placing as COD instead", true);
        }
        // Razorpay modal would open here with gateway_key_id + gateway_order_id.
        // Until keys are configured the order stays 'placed/pending'.
      }

      await reload();
      toast(`Order ${res.order_number} placed`);
      router.push(`/orders/${res.order_number}?new=1`);
    } catch {
      toast("Could not place the order", true);
    } finally {
      setBusy(false);
    }
  }

  const t = cart!.totals;
  return (
    <div className="container section">
      <h2>Checkout</h2>
      <form onSubmit={placeOrder} className="grid" style={{ gridTemplateColumns: "1.4fr 1fr", alignItems: "start", marginTop: 16 }}>
        <div style={{ display: "grid", gap: 16 }}>
          <div className="card pad">
            <h3>Delivery address</h3>
            <div className="field">
              <label>Full name</label>
              <input className="input" required value={addr.full_name} onChange={(e) => setAddr({ ...addr, full_name: e.target.value })} />
            </div>
            <div className="field">
              <label>Phone</label>
              <input className="input" required value={addr.phone} onChange={(e) => setAddr({ ...addr, phone: e.target.value })} />
            </div>
            <div className="field">
              <label>Address line 1</label>
              <input className="input" required value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} />
            </div>
            <div className="field">
              <label>Address line 2 (optional)</label>
              <input className="input" value={addr.line2} onChange={(e) => setAddr({ ...addr, line2: e.target.value })} />
            </div>
            <div className="row" style={{ gap: 12 }}>
              <div className="field grow">
                <label>City</label>
                <input className="input" required value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} />
              </div>
              <div className="field grow">
                <label>State</label>
                <input className="input" required value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} />
              </div>
              <div className="field" style={{ width: 120 }}>
                <label>PIN</label>
                <input className="input" required value={addr.pincode} onChange={(e) => setAddr({ ...addr, pincode: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="card pad">
            <h3>Payment</h3>
            <label className="row" style={{ gap: 10, cursor: "pointer", marginBottom: 8 }}>
              <input type="radio" checked={method === "cod"} onChange={() => setMethod("cod")} />
              <span>Cash / pay on delivery</span>
            </label>
            <label className="row" style={{ gap: 10, cursor: "pointer" }}>
              <input type="radio" checked={method === "upi"} onChange={() => setMethod("upi")} />
              <span>
                Pay online (UPI/card) <span className="muted small">— test mode</span>
              </span>
            </label>
          </div>
        </div>

        <div className="card pad" style={{ display: "grid", gap: 10 }}>
          <h3>Order summary</h3>
          {items.map((it) => (
            <div key={it.id} className="row spread small">
              <span className="muted">
                {it.product?.name} × {it.quantity}
              </span>
              <span>{inr(it.line_subtotal)}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10, display: "grid", gap: 6 }}>
            <div className="row spread small">
              <span className="muted">GST</span>
              <span>{inr(t.gst)}</span>
            </div>
            <div className="row spread small">
              <span className="muted">Shipping</span>
              <span>{t.shipping === 0 ? "Free" : inr(t.shipping)}</span>
            </div>
            <div className="row spread">
              <strong>Total</strong>
              <strong>{inr(t.grand_total)}</strong>
            </div>
          </div>
          <button className="btn btn-primary btn-block" disabled={busy}>
            Place order
          </button>
        </div>
      </form>
    </div>
  );
}
