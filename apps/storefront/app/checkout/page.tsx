"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Schemas } from "@nethrasap/api-client";
import { PhoneField } from "@nethrasap/ui/fields";
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

// Response of GET /checkout/payment-methods — straight from the generated
// OpenAPI schema (availability is config-driven, never hardcoded here).
type PaymentMethodInfo = Schemas["PaymentMethodInfo"];
type PaymentMethodsResponse = Schemas["PaymentMethodsResponse"];

export default function CheckoutPage() {
  const { user, loading } = useAuth();
  const { cart, reload } = useCart();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // Offered methods come from the backend (config-driven, COD-only at
  // launch) — the storefront never hardcodes the list.
  const [methods, setMethods] = useState<PaymentMethodInfo[]>([]);
  const [method, setMethod] = useState<string>("");
  const [addr, setAddr] = useState({
    full_name: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    district: "",
    state: "",
    pincode: "",
    country: "IN",
  });
  // Pincode autofill state: idle while typing, then a resolved/failed result.
  const [pinLookup, setPinLookup] = useState<"idle" | "loading" | "found" | "notfound">("idle");

  useEffect(() => {
    if (user?.profile?.full_name) setAddr((a) => ({ ...a, full_name: user.profile!.full_name }));
    if (user?.phone) setAddr((a) => ({ ...a, phone: a.phone || user.phone.replace("+91", "") }));
  }, [user]);

  // Resolve city / district / state from a 6-digit PIN (debounced). Cached
  // server-side, so repeats are instant; a miss just leaves the fields editable.
  useEffect(() => {
    const pin = addr.pincode;
    if (pin.length !== 6) {
      setPinLookup("idle");
      return;
    }
    let cancelled = false;
    setPinLookup("loading");
    const t = setTimeout(() => {
      api
        .get<{ city: string; district: string; state: string }>(`/pincodes/${pin}`)
        .then((r) => {
          if (cancelled) return;
          setAddr((a) => ({ ...a, city: r.city, district: r.district, state: r.state }));
          setPinLookup("found");
        })
        .catch(() => !cancelled && setPinLookup("notfound"));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // Only re-run when the PIN itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addr.pincode]);

  useEffect(() => {
    api
      .get<PaymentMethodsResponse>("/checkout/payment-methods")
      .then((r) => {
        setMethods(r.methods);
        setMethod((m) => m || r.default);
      })
      .catch(() => toast("Could not load payment options", true));
  }, [toast]);

  if (!loading && !user) {
    return (
      <div className="container section">
        <div className="card pad">
          Please <Link href="/login">sign in</Link> to check out.
        </div>
      </div>
    );
  }

  // Only fixed-price lines are sold here; quote lines live on the cart page's
  // "Request a quote" path (backend enforces the same split).
  const items = (cart?.items ?? []).filter((it) => !it.is_quote_only);
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

      if (res.gateway) {
        // Gateway methods return a Razorpay handshake — the checkout modal
        // ships alongside enabling upi/card/netbanking in PAYMENT_METHODS_ENABLED.
        toast("Online payment isn't available yet — your order is awaiting payment", true);
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
      <form onSubmit={placeOrder} className="two-col" style={{ marginTop: 16 }}>
        <div style={{ display: "grid", gap: 16 }}>
          <div className="card pad">
            <h3>Delivery address</h3>

            <div className="form-grid">
              <div className="field">
                <label>Full name</label>
                <input className="input" required placeholder="e.g. Priya Sharma" value={addr.full_name} onChange={(e) => setAddr({ ...addr, full_name: e.target.value })} />
              </div>
              <PhoneField
                label="Phone"
                compact
                required
                value={addr.phone}
                onChange={(v) => setAddr((a) => ({ ...a, phone: v }))}
              />
            </div>

            <div className="field">
              <label>Address line 1</label>
              <input className="input" required placeholder="House / flat, building, street" value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} />
            </div>

            <div className="form-grid">
              <div className="field">
                <label>Address line 2 (optional)</label>
                <input className="input" placeholder="Area, landmark" value={addr.line2} onChange={(e) => setAddr({ ...addr, line2: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="pin">
                  PIN code
                  {pinLookup === "loading" && <span className="muted small"> · looking up…</span>}
                  {pinLookup === "found" && <span className="small" style={{ color: "var(--ok)" }}> · ✓ filled</span>}
                  {pinLookup === "notfound" && <span className="small" style={{ color: "var(--warn)" }}> · enter manually</span>}
                </label>
                <input
                  id="pin"
                  className="input mono"
                  style={{ letterSpacing: ".08em" }}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="600001"
                  required
                  value={addr.pincode}
                  onChange={(e) => setAddr({ ...addr, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                />
              </div>
            </div>

            <div className="row" style={{ gap: 12 }}>
              <div className="field grow">
                <label>City</label>
                <input className="input" required placeholder="City" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} />
              </div>
              <div className="field grow">
                <label>District</label>
                <input className="input" placeholder="District" value={addr.district} onChange={(e) => setAddr({ ...addr, district: e.target.value })} />
              </div>
              <div className="field grow">
                <label>State</label>
                <input className="input" required placeholder="State" value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="card pad">
            <h3>Payment</h3>
            {methods.length === 0 ? (
              <div className="muted small">Loading payment options…</div>
            ) : (
              methods.map((m) => (
                <label
                  key={m.id}
                  className="row"
                  style={{ gap: 10, cursor: "pointer", marginBottom: 8, alignItems: "start" }}
                >
                  <input
                    type="radio"
                    name="payment-method"
                    checked={method === m.id}
                    onChange={() => setMethod(m.id)}
                  />
                  <span>
                    {m.label}
                    {m.description && (
                      <span className="muted small" style={{ display: "block" }}>
                        {m.description}
                      </span>
                    )}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="card pad summary-card" style={{ display: "grid", gap: 10 }}>
          <h3>Order summary</h3>
          <div className="sum-lines">
            {items.map((it) => (
              <div key={it.id} className="sum-line">
                <div className="sum-thumb">
                  {it.product?.image_storage_key ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={it.product.image_storage_key} alt={it.product?.name ?? ""} loading="lazy" />
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                      <path d="M4 7h16M6 7v12a2 2 0 002 2h8a2 2 0 002-2V7M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
                    </svg>
                  )}
                  <span className="sum-qty">{it.quantity}</span>
                </div>
                <div className="sum-info">
                  <div className="sum-name">{it.product?.name}</div>
                  <div className="muted small">{it.product?.unit_label ?? ""}</div>
                  <div className="muted small">
                    {it.quantity} × {inr(it.unit_price)}
                  </div>
                </div>
                <div className="sum-price mono">{inr(it.unit_price * it.quantity)}</div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10, display: "grid", gap: 6 }}>
            {/* Prices are GST-inclusive, so items subtotal = base + tax. */}
            <div className="row spread small">
              <span className="muted">Items ({items.reduce((n, it) => n + it.quantity, 0)})</span>
              <span>{inr(t.subtotal + t.gst)}</span>
            </div>
            {t.discount > 0 && (
              <div className="row spread small">
                <span className="muted">Discount</span>
                <span style={{ color: "var(--ok)" }}>− {inr(t.discount)}</span>
              </div>
            )}
            <div className="row spread small">
              <span className="muted">Shipping</span>
              <span>{t.shipping === 0 ? "Free" : inr(t.shipping)}</span>
            </div>
            <div className="row spread">
              <strong>Total</strong>
              <strong>{inr(t.grand_total)}</strong>
            </div>
            <div className="row spread" style={{ marginTop: -2 }}>
              <span className="muted small">Inclusive of GST</span>
              <span className="muted small">{inr(t.gst)}</span>
            </div>
          </div>
          <button className="btn btn-primary btn-block" disabled={busy || !method}>
            Place order
          </button>
        </div>
      </form>
    </div>
  );
}
