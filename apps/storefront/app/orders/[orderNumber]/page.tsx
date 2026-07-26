"use client";

import { connectRealtime, type OrderDetail } from "@nethrasap/api-client";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { WS_BASE, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { inr } from "@/lib/format";

export const dynamic = "force-dynamic";

const STEPS = ["confirmed", "packed", "dispatched", "out_for_delivery", "delivered"];

export default function OrderDetailPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const isNew = useSearchParams().get("new");
  const { user, loading } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [live, setLive] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrder(await api.get<OrderDetail>(`/orders/${orderNumber}`));
    } catch {
      setOrder(null);
    }
  }, [orderNumber]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // Live updates: refetch when this order changes on the realtime channel.
  useEffect(() => {
    if (!user) return;
    let handle: { close: () => void } | null = null;
    connectRealtime({
      api,
      wsBase: WS_BASE,
      onOpen: () => setLive(true),
      onClose: () => setLive(false),
      onEvent: (e) => {
        if (e.entity === "order" && e.entity_id === orderNumber) load();
      },
    })
      .then((h) => (handle = h))
      .catch(() => {});
    return () => handle?.close();
  }, [user, orderNumber, load]);

  if (!loading && !user)
    return (
      <div className="container section">
        <div className="card pad">
          Please <Link href="/login">sign in</Link> to view this order.
        </div>
      </div>
    );
  if (!order) return <div className="container section muted">Loading order…</div>;

  const stepIndex = STEPS.indexOf(order.status);
  const cancelled = order.status === "cancelled" || order.status === "payment_failed";

  return (
    <div className="container section">
      {isNew && (
        <div className="card pad" style={{ marginBottom: 16, borderColor: "var(--ok)", background: "#f2f8f2" }}>
          <strong>Thank you! Your order is confirmed.</strong>
          <p className="muted small" style={{ margin: 0 }}>
            We&apos;ll notify you as it moves through fulfilment.
          </p>
        </div>
      )}

      <div className="row spread">
        <h2>{order.order_number}</h2>
        <span className="row small muted" style={{ gap: 6 }}>
          <span
            className="pill"
            style={{ background: live ? "#e6f2e6" : "#eee", color: live ? "var(--ok)" : "var(--ink-3)" }}
          >
            ● {live ? "Live" : "…"}
          </span>
        </span>
      </div>

      {!cancelled && (
        <div className="card pad" style={{ marginTop: 12 }}>
          <div className="row" style={{ gap: 0, justifyContent: "space-between" }}>
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`track-step ${i <= stepIndex ? "is-done" : ""}`}
                style={{ flex: 1, textAlign: "center", position: "relative" }}
              >
                <div className="n">{i <= stepIndex ? "✓" : ""}</div>
                <div className="lab">{s.replace(/_/g, " ")}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="two-col" style={{ marginTop: 16 }}>
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th style={{ textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it) => (
                <tr key={it.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{it.product_name}</div>
                  </td>
                  <td>{it.quantity}</td>
                  <td style={{ textAlign: "right" }}>{inr(it.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div className="card pad" style={{ display: "grid", gap: 6 }}>
            <div className="row spread small">
              <span className="muted">Status</span>
              <span className="pill pill-rx">{order.status.replace(/_/g, " ")}</span>
            </div>
            <div className="row spread small">
              <span className="muted">Payment</span>
              <span>{order.payment_status.replace(/_/g, " ")}</span>
            </div>
            <div className="row spread">
              <strong>Total</strong>
              <strong>{inr(order.grand_total)}</strong>
            </div>
            {order.status === "confirmed" && (
              <Link href={`/orders/${order.order_number}/invoice`} className="btn btn-outline btn-sm btn-block">
                Download invoice
              </Link>
            )}
          </div>

          {order.status_history.length > 0 && (
            <div className="card pad">
              <h4>Timeline</h4>
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {order.status_history.map((h, i) => (
                  <div key={i} className="row spread small">
                    <span>{h.status.replace(/_/g, " ")}</span>
                    <span className="muted">{new Date(h.at).toLocaleString("en-IN")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
