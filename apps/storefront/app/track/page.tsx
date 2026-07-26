"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { inr } from "@/lib/format";

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

  if (loading) {
    return <div className="container section muted">Loading…</div>;
  }

  // Gate behind sign-in — tracking is tied to the logged-in account.
  if (!user) {
    return (
      <div className="container section" style={{ maxWidth: 520 }}>
        <h2>Track your order</h2>
        <div className="card pad" style={{ marginTop: 12, display: "grid", gap: 12 }}>
          <p className="muted" style={{ margin: 0 }}>
            Please sign in to see your orders and track their status.
          </p>
          <Link href="/login?next=/track" className="btn btn-primary" style={{ justifySelf: "start" }}>
            Sign in to track
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container section">
      <h2>Track your order</h2>
      <p className="muted small">Pick an order to see its items and delivery status.</p>

      <div className="two-col" style={{ marginTop: 16 }}>
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
