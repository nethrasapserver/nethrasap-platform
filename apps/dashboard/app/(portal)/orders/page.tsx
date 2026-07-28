"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { OrderDrawer } from "@/components/OrderDrawer";
import { dateShort, inr, statusPill } from "@/lib/format";
import { useApi } from "@/lib/useApi";

interface AdminOrder {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  grand_total: number;
  item_count: number;
  placed_at: string;
  customer_name: string;
  customer_phone: string;
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="card empty">Loading…</div>}>
      <OrdersInner />
    </Suspense>
  );
}

function OrdersInner() {
  const [status, setStatus] = useState("");
  // Deep-linkable: /orders?open=NS-2026-00015 opens that order's drawer.
  const [openOrder, setOpenOrder] = useState<string | null>(useSearchParams().get("open"));
  const { data, loading, refetch } = useApi<{ items: AdminOrder[]; total: number }>(
    "/admin/orders",
    status ? { status } : undefined,
  );

  return (
    <div>
      <div className="page-head">
        <h1>Orders</h1>
        <div className="row" style={{ gap: 12 }}>
          <span className="muted small" style={{ alignSelf: "center" }}>{data?.total ?? 0} total</span>
          <select className="input" style={{ width: 160 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="placed">Placed</option>
            <option value="confirmed">Confirmed</option>
            <option value="packed">Packed</option>
            <option value="dispatched">Dispatched</option>
            <option value="out_for_delivery">Out for delivery</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>
      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Placed</th>
              <th>Status</th>
              <th>Payment</th>
              <th className="num">Items</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="empty">Loading…</td>
              </tr>
            )}
            {data?.items.map((o) => (
              <tr
                key={o.order_number}
                onClick={() => setOpenOrder(o.order_number)}
                onKeyDown={(e) => e.key === "Enter" && setOpenOrder(o.order_number)}
                tabIndex={0}
                style={{ cursor: "pointer" }}
                aria-label={`View ${o.order_number}`}
              >
                <td style={{ fontWeight: 600, color: "var(--brand-dark)" }}>{o.order_number}</td>
                <td>
                  {o.customer_name}
                  {o.customer_phone && <div className="muted small mono">{o.customer_phone}</div>}
                </td>
                <td className="muted">{dateShort(o.placed_at)}</td>
                <td>
                  <span className={`pill ${statusPill(o.status)}`}>{o.status.replace(/_/g, " ")}</span>
                </td>
                <td>
                  <span className={`pill ${statusPill(o.payment_status)}`}>{o.payment_status.replace(/_/g, " ")}</span>
                </td>
                <td className="num">{o.item_count}</td>
                <td className="num" style={{ fontWeight: 600 }}>{inr(o.grand_total)}</td>
              </tr>
            ))}
            {!loading && data?.items.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">No orders{status ? " in this status" : " yet"}.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {openOrder && (
        <OrderDrawer orderNumber={openOrder} onClose={() => setOpenOrder(null)} onChanged={refetch} />
      )}
    </div>
  );
}
