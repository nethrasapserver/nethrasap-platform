"use client";

import type { OrderDetail } from "@nethrasap/api-client";
import { useState } from "react";
import { Drawer } from "@/components/Drawer";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateShort, dateTime, inr, statusPill, toPaise } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { useApi } from "@/lib/useApi";

/** The fulfilment walk, in order. Placed sits before the first stage. */
const STAGES = [
  { key: "confirmed", label: "Confirmed" },
  { key: "packed", label: "Packed" },
  { key: "dispatched", label: "Dispatched" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
] as const;

/** Visual delivery rail: done stages filled with their timestamps from the
    status history; terminal states (cancelled/refunded) show a notice. */
function DeliveryProgress({ o }: { o: OrderDetail }) {
  const terminal = ["cancelled", "payment_failed", "refunded"].includes(o.status);
  if (terminal) {
    return (
      <p className="small" style={{ color: "var(--danger)", margin: "0 0 6px" }}>
        This order is {o.status.replace(/_/g, " ")} — the delivery walk ended.
      </p>
    );
  }
  const rank = STAGES.findIndex((s) => s.key === o.status);
  const at = (key: string) => o.status_history.find((h) => h.status === key)?.at;
  return (
    <div className="oship" aria-label="Delivery progress">
      {STAGES.map((s, i) => {
        const ts = at(s.key);
        return (
          <div key={s.key} className={`stp ${i <= rank ? "is-done" : ""}`}>
            <span className="dot" />
            {s.label}
            <small>{ts ? dateShort(ts) : "—"}</small>
          </div>
        );
      })}
    </div>
  );
}

/** The single surface for one order: full context + every fulfilment action.
    Dispatch/refund swap the panel content in place (no stacked drawers). */
export function OrderDrawer({
  orderNumber,
  onClose,
  onChanged,
}: {
  orderNumber: string;
  onClose: () => void;
  /** Called after any mutation so the list behind the drawer can refetch. */
  onChanged?: () => void;
}) {
  const { can } = useAuth();
  const toast = useToast();
  const { data: o, loading, error, refetch } = useApi<OrderDetail>(`/orders/${orderNumber}`);
  const [view, setView] = useState<"detail" | "dispatch" | "refund">("detail");

  function mutated() {
    setView("detail");
    refetch();
    onChanged?.();
  }

  async function walk(status: string) {
    try {
      await api.patch(`/admin/orders/${orderNumber}/shipment`, { status });
      toast(`Marked ${status.replace(/_/g, " ")}`);
      mutated();
    } catch {
      toast("Update failed", true);
    }
  }

  // Records that the delivery agent collected the cash for a COD order. Backend
  // endpoint is being added this gate — see notes for the lead to confirm.
  async function collectCod() {
    try {
      await api.post(`/admin/orders/${orderNumber}/cod-collected`);
      toast("COD marked collected");
      mutated();
    } catch {
      toast("Could not mark COD collected", true);
    }
  }

  if (view === "dispatch") {
    return (
      <DispatchDrawer orderNumber={orderNumber} onClose={() => setView("detail")} onDone={mutated} />
    );
  }
  if (view === "refund" && o) {
    return (
      <RefundDrawer
        orderNumber={orderNumber}
        max={o.grand_total}
        onClose={() => setView("detail")}
        onDone={mutated}
      />
    );
  }

  const canDispatch = o && can("orders:fulfil") && ["confirmed", "packed"].includes(o.status);
  const canRefund = o && can("orders:refund") && ["captured", "partial_refund"].includes(o.payment_status);
  const canWalk = o && can("orders:fulfil") && o.shipment && o.status !== "delivered";
  // COD cash is collected on delivery; once collected, payment_status flips to
  // captured, which is what makes Refund available afterwards.
  const canCollectCod =
    o &&
    can("orders:fulfil") &&
    o.payment_method === "cod" &&
    o.status === "delivered" &&
    o.payment_status === "cod_pending";

  return (
    <Drawer
      wide
      title={orderNumber}
      subtitle={o ? `Placed ${dateTime(o.placed_at)}` : undefined}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          {canCollectCod && (
            <button className="btn btn-primary" onClick={collectCod}>
              Mark COD collected
            </button>
          )}
          {canRefund && (
            <button className="btn btn-danger" onClick={() => setView("refund")}>
              Refund
            </button>
          )}
          {canWalk && o.status === "dispatched" && (
            <button className="btn btn-outline" onClick={() => walk("out_for_delivery")}>
              Out for delivery
            </button>
          )}
          {canWalk && o.status === "out_for_delivery" && (
            <button className="btn btn-primary" onClick={() => walk("delivered")}>
              Mark delivered
            </button>
          )}
          {canDispatch && (
            <button className="btn btn-primary" onClick={() => setView("dispatch")}>
              Dispatch
            </button>
          )}
        </>
      }
    >
      {loading && <p className="muted">Loading…</p>}
      {error && <p className="muted">Could not load this order.</p>}
      {o && (
        <>
          <div className="row" style={{ gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <span className={`pill ${statusPill(o.status)}`}>{o.status.replace(/_/g, " ")}</span>
            <span className={`pill ${statusPill(o.payment_status)}`}>
              {o.payment_method.toUpperCase()} · {o.payment_status.replace(/_/g, " ")}
            </span>
          </div>

          <DeliveryProgress o={o} />

          <h4 className="drawer-h">Details</h4>
          <dl className="drawer-dl">
            <dt>Customer</dt>
            <dd>
              <b>{o.shipping_address.full_name}</b>
              <div className="muted small mono">{o.shipping_address.phone}</div>
            </dd>
            <dt>Ship to</dt>
            <dd>
              {o.shipping_address.line1}
              {o.shipping_address.line2 ? `, ${o.shipping_address.line2}` : ""}
              <div className="muted small">
                {o.shipping_address.city}, {o.shipping_address.state} {o.shipping_address.pincode}
              </div>
            </dd>
            {o.coupon_code && (
              <>
                <dt>Coupon</dt>
                <dd className="mono">{o.coupon_code}</dd>
              </>
            )}
            {o.notes && (
              <>
                <dt>Notes</dt>
                <dd>{o.notes}</dd>
              </>
            )}
            {o.delivered_at && (
              <>
                <dt>Delivered</dt>
                <dd>{dateTime(o.delivered_at)}</dd>
              </>
            )}
          </dl>

          <h4 className="drawer-h">Items ({o.items.length})</h4>
          <table className="tbl">
            <thead>
              <tr>
                <th>Item</th>
                <th className="num">Qty</th>
                <th className="num">Rate</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {o.items.map((it) => (
                <tr key={it.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{it.product_name}</div>
                    <div className="muted small">
                      {it.unit_label} · GST {it.gst_rate_pct}%
                    </div>
                  </td>
                  <td className="num">{it.quantity}</td>
                  <td className="num mono">{inr(it.unit_price)}</td>
                  <td className="num mono">{inr(it.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4 className="drawer-h">Summary</h4>
          <dl className="drawer-dl">
            <dt>Taxable value</dt>
            <dd className="mono">{inr(o.subtotal)}</dd>
            {o.discount_total > 0 && (
              <>
                <dt>Discount</dt>
                <dd className="mono">−{inr(o.discount_total)}</dd>
              </>
            )}
            <dt>GST</dt>
            <dd className="mono">{inr(o.gst_total)}</dd>
            <dt>Shipping</dt>
            <dd className="mono">{inr(o.shipping_total)}</dd>
            <dt>
              <b>Grand total</b>
            </dt>
            <dd className="mono" style={{ fontWeight: 700 }}>
              {inr(o.grand_total)}
            </dd>
          </dl>

          {o.shipment && (
            <>
              <h4 className="drawer-h">Shipment</h4>
              <dl className="drawer-dl">
                <dt>Status</dt>
                <dd>
                  <span className={`pill ${statusPill(o.shipment.status)}`}>
                    {o.shipment.status.replace(/_/g, " ")}
                  </span>
                </dd>
                {o.shipment.courier && (
                  <>
                    <dt>Courier</dt>
                    <dd>{o.shipment.courier}</dd>
                  </>
                )}
                {o.shipment.awb_number && (
                  <>
                    <dt>AWB</dt>
                    <dd className="mono">
                      {o.shipment.tracking_url ? (
                        <a href={o.shipment.tracking_url} target="_blank" rel="noopener noreferrer">
                          {o.shipment.awb_number} ↗
                        </a>
                      ) : (
                        o.shipment.awb_number
                      )}
                    </dd>
                  </>
                )}
                {o.shipment.dispatched_at && (
                  <>
                    <dt>Dispatched</dt>
                    <dd>{dateTime(o.shipment.dispatched_at)}</dd>
                  </>
                )}
                {o.shipment.eta && (
                  <>
                    <dt>ETA</dt>
                    <dd>{dateTime(o.shipment.eta)}</dd>
                  </>
                )}
              </dl>
            </>
          )}

          {o.payments.length > 0 && (
            <>
              <h4 className="drawer-h">Payments</h4>
              <dl className="drawer-dl">
                {o.payments.map((p, i) => (
                  <div key={i} style={{ display: "contents" }}>
                    <dt>{p.method.toUpperCase()}</dt>
                    <dd>
                      <span className="mono">{inr(p.amount)}</span>{" "}
                      <span className="muted small">
                        · {p.status.replace(/_/g, " ")}
                        {p.captured_at ? ` · ${dateTime(p.captured_at)}` : ""}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          )}

          {o.status_history.length > 0 && (
            <>
              <h4 className="drawer-h">Timeline</h4>
              <div style={{ display: "grid", gap: 8 }}>
                {o.status_history.map((h, i) => (
                  <div key={i} className="row spread small" style={{ gap: 10 }}>
                    <span>
                      {h.status.replace(/_/g, " ")}
                      {h.note && <span className="muted"> — {h.note}</span>}
                    </span>
                    <span className="muted mono" style={{ flex: "none" }}>
                      {dateTime(h.at)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Drawer>
  );
}

function DispatchDrawer({
  orderNumber,
  onClose,
  onDone,
}: {
  orderNumber: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [courier, setCourier] = useState("Delhivery");
  const [awb, setAwb] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Drawer
      title="Dispatch order"
      subtitle={`${orderNumber} — reserved stock will be fulfilled`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Back
          </button>
          <button
            className="btn btn-primary"
            disabled={busy || !awb}
            onClick={async () => {
              setBusy(true);
              try {
                await api.post(`/admin/orders/${orderNumber}/shipment`, { courier, awb_number: awb });
                toast("Order dispatched — stock fulfilled");
                onDone();
              } catch {
                toast("Could not dispatch the order", true);
                setBusy(false);
              }
            }}
          >
            {busy ? "Dispatching…" : "Confirm dispatch"}
          </button>
        </>
      }
    >
      <div className="field">
        <label>Courier</label>
        <input className="input" value={courier} onChange={(e) => setCourier(e.target.value)} />
      </div>
      <div className="field">
        <label>AWB / tracking number</label>
        <input className="input" value={awb} onChange={(e) => setAwb(e.target.value)} placeholder="Required" />
      </div>
    </Drawer>
  );
}

function RefundDrawer({
  orderNumber,
  max,
  onClose,
  onDone,
}: {
  orderNumber: string;
  max: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [full, setFull] = useState(true);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  // Guard the partial-refund amount client-side; the API is the final authority.
  const overMax = !full && toPaise(amount) > max;
  return (
    <Drawer
      title="Refund order"
      subtitle={`${orderNumber} — paid ${inr(max)}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Back
          </button>
          <button
            className="btn btn-danger"
            disabled={busy || overMax || (!full && !amount)}
            onClick={async () => {
              setBusy(true);
              try {
                await api.post(`/admin/orders/${orderNumber}/refund`, {
                  amount_paise: full ? undefined : toPaise(amount),
                  reason,
                });
                toast("Refund initiated");
                onDone();
              } catch {
                toast("Could not process the refund", true);
                setBusy(false);
              }
            }}
          >
            {busy ? "Processing…" : `Refund ${inr(full ? max : toPaise(amount))}`}
          </button>
        </>
      }
    >
      <label className="row" style={{ gap: 8, marginBottom: 14, cursor: "pointer" }}>
        <input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} />
        Full refund — {inr(max)}
      </label>

      {!full && (
        <div className="field">
          <label>Amount (₹)</label>
          <input
            className="input"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Up to ${inr(max)}`}
          />
          {overMax && <p className="small" style={{ color: "var(--danger)", margin: "4px 0 0" }}>Exceeds the amount paid.</p>}
        </div>
      )}
      <div className="field">
        <label>Reason</label>
        <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </Drawer>
  );
}
