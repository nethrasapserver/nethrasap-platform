"use client";

import type { OrderDetail } from "@nethrasap/api-client";
import Link from "next/link";
import { Drawer } from "@/components/Drawer";
import { dateTime, inr, statusPill } from "@/lib/format";
import { useApi } from "@/lib/useApi";

/** Full order context in a side panel — everything the detail page knows,
    readable without leaving the orders list. Actions (dispatch, refund,
    shipment walk) live on the full view, linked from the footer. */
export function OrderDrawer({ orderNumber, onClose }: { orderNumber: string; onClose: () => void }) {
  const { data: o, loading, error } = useApi<OrderDetail>(`/orders/${orderNumber}`);

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
          <Link href={`/orders/${orderNumber}`} className="btn btn-primary">
            Open full view →
          </Link>
        </>
      }
    >
      {loading && <p className="muted">Loading…</p>}
      {error && <p className="muted">Could not load this order.</p>}
      {o && (
        <>
          <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <span className={`pill ${statusPill(o.status)}`}>{o.status.replace(/_/g, " ")}</span>
            <span className={`pill ${statusPill(o.payment_status)}`}>
              {o.payment_method.toUpperCase()} · {o.payment_status.replace(/_/g, " ")}
            </span>
          </div>

          <dl className="drawer-dl" style={{ marginBottom: 18 }}>
            <dt>Customer</dt>
            <dd>
              {o.shipping_address.full_name}
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

          <h4 style={{ margin: "0 0 8px" }}>Items ({o.items.length})</h4>
          <table className="tbl" style={{ marginBottom: 16 }}>
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

          <dl className="drawer-dl" style={{ marginBottom: 18 }}>
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
              <h4 style={{ margin: "0 0 8px" }}>Shipment</h4>
              <dl className="drawer-dl" style={{ marginBottom: 18 }}>
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
              <h4 style={{ margin: "0 0 8px" }}>Payments</h4>
              <dl className="drawer-dl" style={{ marginBottom: 18 }}>
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
              <h4 style={{ margin: "0 0 8px" }}>Timeline</h4>
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
