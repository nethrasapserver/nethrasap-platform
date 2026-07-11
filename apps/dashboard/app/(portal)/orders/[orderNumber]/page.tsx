"use client";

import type { OrderDetail } from "@nethrasap/api-client";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime, inrExact, statusPill } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { useApi } from "@/lib/useApi";

export default function OrderDetailPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const { can } = useAuth();
  const toast = useToast();
  const { data: order, loading, refetch } = useApi<OrderDetail>(`/orders/${orderNumber}`);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);

  if (loading || !order) return <div className="card empty">Loading…</div>;

  const canDispatch = can("orders:fulfil") && ["confirmed", "packed"].includes(order.status);
  const canRefund = can("orders:refund") && ["captured", "partial_refund"].includes(order.payment_status);
  const canWalk = can("orders:fulfil") && order.shipment && order.status !== "delivered";

  async function walk(status: string) {
    try {
      await api.patch(`/admin/orders/${orderNumber}/shipment`, { status });
      toast(`Marked ${status.replace(/_/g, " ")}`);
      refetch();
    } catch {
      toast("Update failed", true);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>{order.order_number}</h1>
        <div className="row">
          {canDispatch && (
            <button className="btn btn-primary btn-sm" onClick={() => setDispatchOpen(true)}>
              Dispatch
            </button>
          )}
          {canWalk && order.status === "dispatched" && (
            <button className="btn btn-outline btn-sm" onClick={() => walk("out_for_delivery")}>
              Out for delivery
            </button>
          )}
          {canWalk && order.status === "out_for_delivery" && (
            <button className="btn btn-outline btn-sm" onClick={() => walk("delivered")}>
              Mark delivered
            </button>
          )}
          {canRefund && (
            <button className="btn btn-danger btn-sm" onClick={() => setRefundOpen(true)}>
              Refund
            </button>
          )}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.5fr 1fr", alignItems: "start" }}>
        <div className="card">
          <table className="tbl">
            <thead>
              <tr>
                <th>Item</th>
                <th className="num">Qty</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it) => (
                <tr key={it.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{it.product_name}</div>
                    <div className="muted small">{it.brand}</div>
                  </td>
                  <td className="num">{it.quantity}</td>
                  <td className="num">{inrExact(it.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid">
          <div className="card pad">
            <div className="row spread">
              <span className="muted">Status</span>
              <span className={`pill ${statusPill(order.status)}`}>{order.status.replace(/_/g, " ")}</span>
            </div>
            <div className="row spread" style={{ marginTop: 8 }}>
              <span className="muted">Payment</span>
              <span className={`pill ${statusPill(order.payment_status)}`}>
                {order.payment_status.replace(/_/g, " ")} ({order.payment_method})
              </span>
            </div>
            <div className="row spread" style={{ marginTop: 8 }}>
              <strong>Total</strong>
              <strong>{inrExact(order.grand_total)}</strong>
            </div>
            {order.shipment && (
              <div className="small muted" style={{ marginTop: 10 }}>
                {order.shipment.courier} · AWB {order.shipment.awb_number}
              </div>
            )}
          </div>

          <div className="card pad">
            <h4>Timeline</h4>
            {order.status_history.map((h, i) => (
              <div key={i} className="row spread small" style={{ marginTop: 6 }}>
                <span>{h.status.replace(/_/g, " ")}</span>
                <span className="muted">{dateTime(h.at)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {dispatchOpen && (
        <DispatchModal
          orderNumber={orderNumber}
          onClose={() => setDispatchOpen(false)}
          onDone={() => {
            setDispatchOpen(false);
            refetch();
          }}
        />
      )}
      {refundOpen && (
        <RefundModal
          orderNumber={orderNumber}
          max={order.grand_total}
          onClose={() => setRefundOpen(false)}
          onDone={() => {
            setRefundOpen(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function DispatchModal({ orderNumber, onClose, onDone }: { orderNumber: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [courier, setCourier] = useState("Delhivery");
  const [awb, setAwb] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Dispatch order" onClose={onClose}>
      <div className="field">
        <label>Courier</label>
        <input className="input" value={courier} onChange={(e) => setCourier(e.target.value)} />
      </div>
      <div className="field">
        <label>AWB / tracking number</label>
        <input className="input" value={awb} onChange={(e) => setAwb(e.target.value)} />
      </div>
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
            toast("Dispatch failed", true);
            setBusy(false);
          }
        }}
      >
        Confirm dispatch
      </button>
    </Modal>
  );
}

function RefundModal({
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
  return (
    <Modal title="Refund order" onClose={onClose}>
      <label className="row" style={{ gap: 8, marginBottom: 10 }}>
        <input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} /> Full refund
      </label>
      {!full && (
        <div className="field">
          <label>Amount (paise, max {max})</label>
          <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
      )}
      <div className="field">
        <label>Reason</label>
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <button
        className="btn btn-danger"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api.post(`/admin/orders/${orderNumber}/refund`, {
              amount_paise: full ? undefined : Number(amount),
              reason,
            });
            toast("Refund initiated");
            onDone();
          } catch {
            toast("Refund failed", true);
            setBusy(false);
          }
        }}
      >
        Process refund
      </button>
    </Modal>
  );
}
