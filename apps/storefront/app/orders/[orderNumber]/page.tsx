"use client";

import { ApiError, connectRealtime, type OrderDetail } from "@nethrasap/api-client";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { WS_BASE, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { inr } from "@/lib/format";
import { useToast } from "@/lib/toast";

export const dynamic = "force-dynamic";

const STEPS = ["confirmed", "packed", "dispatched", "out_for_delivery", "delivered"];

export default function OrderDetailPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const isNew = useSearchParams().get("new");
  const { user, loading } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "notfound" | "error">("loading");
  const [live, setLive] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setOrder(await api.get<OrderDetail>(`/orders/${orderNumber}`));
      setStatus("ok");
    } catch (e) {
      setOrder(null);
      // 404 (unknown number) and 403 (not your order) are both "can't find it"
      // for the buyer; anything else is a transient error worth retrying.
      setStatus(e instanceof ApiError && (e.status === 404 || e.status === 403) ? "notfound" : "error");
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

  if (status === "notfound")
    return (
      <div className="container section">
        <div className="card pad" style={{ maxWidth: 520, display: "grid", gap: 12 }}>
          <h2 style={{ margin: 0 }}>We couldn&apos;t find that order</h2>
          <p className="muted" style={{ margin: 0 }}>
            No order matches <b className="mono">{orderNumber}</b> on your account. Double-check the
            number, or look it up by number and phone.
          </p>
          <div className="row" style={{ gap: 8 }}>
            <Link href="/track" className="btn btn-primary">Track an order</Link>
            <Link href="/account" className="btn btn-outline">Your orders</Link>
          </div>
        </div>
      </div>
    );

  if (status === "error")
    return (
      <div className="container section">
        <div className="card pad" style={{ maxWidth: 520, display: "grid", gap: 12 }}>
          <h2 style={{ margin: 0 }}>Couldn&apos;t load this order</h2>
          <p className="muted" style={{ margin: 0 }}>
            Something went wrong while fetching this order. Please try again.
          </p>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn-primary" onClick={() => load()}>
              Try again
            </button>
            <Link href="/account" className="btn btn-outline">Your orders</Link>
          </div>
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
            {(["dispatched", "out_for_delivery", "delivered"].includes(order.status) ||
              ["captured", "refunded", "partial_refund"].includes(order.payment_status)) && (
              <InvoiceButton orderNumber={order.order_number} />
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

/** Fetches a short-lived presigned URL for the invoice PDF and opens it. */
function InvoiceButton({ orderNumber }: { orderNumber: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn-outline btn-sm btn-block"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const d = await api.get<{ url: string }>(`/orders/${orderNumber}/invoice`);
          window.open(d.url, "_blank", "noopener");
        } catch {
          toast("Invoice isn't ready yet — try again shortly", true);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Preparing…" : "Download invoice"}
    </button>
  );
}
