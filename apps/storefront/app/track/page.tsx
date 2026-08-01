"use client";

import { ApiError, type Schemas } from "@nethrasap/api-client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { inr } from "@/lib/format";

type TrackPublic = Schemas["TrackOrderPublic"];

interface OrderRow {
  order_number: string;
  status: string;
  payment_status: string;
  grand_total: number;
  placed_at: string;
}
interface OrderDetail extends OrderRow {
  items: { id: string; product_name: string; quantity: number }[];
  status_history: { status: string; at: string; note?: string | null }[];
}

const STEPS = ["confirmed", "packed", "dispatched", "out_for_delivery", "delivered"];
const STEP_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  packed: "Packed",
  dispatched: "Dispatched",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
};

export default function TrackPage() {
  const { user, loading } = useAuth();
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    api
      .get<{ items: OrderRow[] }>("/orders")
      .then((r) => setOrders(r.items ?? []))
      .catch(() => setOrders([]));
  }, [user]);

  const openOrder = useCallback(async (num: string) => {
    setSelected(num);
    setDetail(null);
    setBusy(true);
    try {
      setDetail(await api.get<OrderDetail>(`/orders/${num}`));
    } catch {
      setDetail(null);
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="container section">
      <h2>Track your order</h2>
      <p className="muted small">
        Look up any order by its number, or pick one from your account.
      </p>

      {/* Public lookup — no sign-in required (order number + phone last 4). */}
      <PublicLookup />

      {/* Signed-in order list */}
      {loading ? (
        <div className="muted small" style={{ marginTop: 24 }}>Loading your account…</div>
      ) : !user ? (
        <div
          className="card pad"
          style={{ marginTop: 24, maxWidth: 520, display: "grid", gap: 12 }}
        >
          <p className="muted" style={{ margin: 0 }}>
            Sign in to see all your orders and follow them with live updates.
          </p>
          <Link href="/login?next=/track" className="btn btn-outline" style={{ justifySelf: "start" }}>
            Sign in
          </Link>
        </div>
      ) : (
        <>
          <h3 style={{ marginTop: 28 }}>Your orders</h3>
          <div className="two-col" style={{ marginTop: 12 }}>
            {/* Order list */}
            <div className="card" style={{ alignSelf: "start" }}>
              {orders === null ? (
                <div className="pad muted small">Loading your orders…</div>
              ) : orders.length === 0 ? (
                <div className="pad muted small">
                  No orders yet. <Link href="/products">Browse products →</Link>
                </div>
              ) : (
                <div className="track-list">
                  {orders.map((o) => (
                    <button
                      key={o.order_number}
                      className={`track-order ${selected === o.order_number ? "is-active" : ""}`}
                      onClick={() => openOrder(o.order_number)}
                    >
                      <div className="row spread">
                        <b className="mono">{o.order_number}</b>
                        <span className={`pill ${statusPill(o.status)}`}>{label(o.status)}</span>
                      </div>
                      <span className="track-order-sub">
                        {inr(o.grand_total)} · {new Date(o.placed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected order status */}
            <div className="card pad" style={{ alignSelf: "start" }}>
              {!selected ? (
                <p className="muted small" style={{ margin: 0 }}>Select an order on the left to track it.</p>
              ) : busy || !detail ? (
                <p className="muted small" style={{ margin: 0 }}>Loading status…</p>
              ) : (
                <OrderStatus detail={detail} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Public order-number lookup ----------
   The hero + nav CTAs promise number-based tracking for anyone, so this calls
   the public endpoint (order number + last 4 phone digits) — no sign-in. */
function PublicLookup() {
  const [num, setNum] = useState("");
  const [last4, setLast4] = useState("");
  const [result, setResult] = useState<TrackPublic | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = num.trim().length > 0 && last4.length === 4;

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const r = await api.get<TrackPublic>(
        `/orders/${encodeURIComponent(num.trim())}/track`,
        { phone_last4: last4 },
      );
      setResult(r);
    } catch (err) {
      setError(
        err instanceof ApiError && (err.status === 404 || err.status === 403 || err.status === 422)
          ? "No order matches that number and phone. Check both and try again."
          : "We couldn't look up that order right now. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card pad" style={{ marginTop: 16, maxWidth: 640, display: "grid", gap: 12 }}>
      <form onSubmit={lookup} noValidate style={{ display: "grid", gap: 12 }}>
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "2 1 200px", margin: 0 }}>
            <label htmlFor="track-num">Order number</label>
            <input
              id="track-num"
              className="input"
              placeholder="e.g. NS-2026-01234"
              value={num}
              onChange={(e) => setNum(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="field" style={{ flex: "1 1 120px", margin: 0 }}>
            <label htmlFor="track-last4">Phone (last 4)</label>
            <input
              id="track-last4"
              className="input"
              inputMode="numeric"
              maxLength={4}
              placeholder="1234"
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
              autoComplete="off"
            />
          </div>
        </div>
        <button className="btn btn-primary" style={{ justifySelf: "start" }} disabled={busy || !canSubmit}>
          {busy ? "Looking up…" : "Track order"}
        </button>
      </form>

      {error && (
        <p className="field-error" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      )}

      {result && <PublicResult r={result} />}
    </div>
  );
}

function PublicResult({ r }: { r: TrackPublic }) {
  const cancelled = r.status === "cancelled" || r.status === "payment_failed";
  const stepIndex = STEPS.indexOf(r.status);
  return (
    <div style={{ display: "grid", gap: 16, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
      <div className="row spread">
        <h3 className="mono" style={{ margin: 0 }}>{r.order_number}</h3>
        <span className={`pill ${cancelled ? "pill-out" : statusPill(r.status)}`}>{label(r.status)}</span>
      </div>

      <div className="row spread small">
        <span className="muted">
          {r.item_count} item{r.item_count === 1 ? "" : "s"} · {new Date(r.placed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </span>
        <b className="mono">{inr(r.grand_total)}</b>
      </div>

      {!cancelled && (
        <div>
          <span className="track-label">Delivery status</span>
          <div className="row" style={{ gap: 0, justifyContent: "space-between", marginTop: 12 }}>
            {STEPS.map((s, i) => (
              <div key={s} className={`track-step ${i <= stepIndex ? "is-done" : ""}`} style={{ flex: 1, textAlign: "center" }}>
                <div className="n">{i <= stepIndex ? "✓" : ""}</div>
                <div className="lab">{STEP_LABEL[s]}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {r.shipment && (r.shipment.courier || r.shipment.tracking_url) && (
        <div className="row spread small">
          <span className="muted">
            {r.shipment.courier ?? "Courier"}
            {r.shipment.awb_number ? ` · ${r.shipment.awb_number}` : ""}
          </span>
          {r.shipment.tracking_url && (
            <a href={r.shipment.tracking_url} target="_blank" rel="noopener noreferrer">
              Track shipment →
            </a>
          )}
        </div>
      )}

      {r.timeline.length > 0 && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <span className="track-label">History</span>
          <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
            {[...r.timeline].reverse().map((h, i) => (
              <div key={i} className="row spread small">
                <span>{label(h.status)}{h.note ? ` — ${h.note}` : ""}</span>
                <span className="muted mono">{new Date(h.at).toLocaleString("en-IN")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OrderStatus({ detail }: { detail: OrderDetail }) {
  const cancelled = detail.status === "cancelled" || detail.status === "payment_failed";
  const stepIndex = STEPS.indexOf(detail.status);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="row spread">
        <h3 className="mono" style={{ margin: 0 }}>{detail.order_number}</h3>
        <span className={`pill ${cancelled ? "pill-out" : statusPill(detail.status)}`}>{label(detail.status)}</span>
      </div>

      {/* Items in this order */}
      <div>
        <span className="track-label">Items</span>
        <div style={{ display: "grid", gap: 4, marginTop: 4 }}>
          {detail.items.map((it) => (
            <div key={it.id} className="row spread small">
              <span>{it.product_name}</span>
              <span className="muted">× {it.quantity}</span>
            </div>
          ))}
          <div className="row spread" style={{ borderTop: "1px solid var(--line)", paddingTop: 8, marginTop: 4 }}>
            <b>Total</b>
            <b className="mono">{inr(detail.grand_total)}</b>
          </div>
        </div>
      </div>

      {/* Delivery progress */}
      {!cancelled && (
        <div>
          <span className="track-label">Delivery status</span>
          <div className="row" style={{ gap: 0, justifyContent: "space-between", marginTop: 12 }}>
            {STEPS.map((s, i) => (
              <div key={s} className={`track-step ${i <= stepIndex ? "is-done" : ""}`} style={{ flex: 1, textAlign: "center" }}>
                <div className="n">{i <= stepIndex ? "✓" : ""}</div>
                <div className="lab">{STEP_LABEL[s]}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {detail.status === "pending" && (
        <p className="small muted" style={{ margin: 0 }}>
          We&apos;ve received your order — you&apos;ll see it move here as soon as it&apos;s confirmed.
        </p>
      )}

      {/* History */}
      {detail.status_history.length > 0 && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <span className="track-label">History</span>
          <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
            {[...detail.status_history].reverse().map((h, i) => (
              <div key={i} className="row spread small">
                <span>{label(h.status)}{h.note ? ` — ${h.note}` : ""}</span>
                <span className="muted mono">{new Date(h.at).toLocaleString("en-IN")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const label = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function statusPill(status: string): string {
  if (status === "delivered") return "pill-ok";
  if (status === "cancelled" || status === "payment_failed") return "pill-out";
  if (status === "pending") return "pill-low";
  return "pill-info";
}
