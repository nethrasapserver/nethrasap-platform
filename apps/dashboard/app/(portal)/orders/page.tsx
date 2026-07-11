"use client";

import type { OrderListItem } from "@nethrasap/api-client";
import Link from "next/link";
import { dateShort, inr, statusPill } from "@/lib/format";
import { useApi } from "@/lib/useApi";

export default function OrdersPage() {
  const { data, loading } = useApi<{ items: OrderListItem[]; total: number }>("/orders", { limit: 100 });

  return (
    <div>
      <div className="page-head">
        <h1>Orders</h1>
        <span className="muted small">{data?.total ?? 0} total</span>
      </div>
      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Order</th>
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
                <td colSpan={6} className="empty">
                  Loading…
                </td>
              </tr>
            )}
            {data?.items.map((o) => (
              <tr key={o.order_number}>
                <td>
                  <Link href={`/orders/${o.order_number}`} style={{ fontWeight: 600, color: "var(--brand-dark)" }}>
                    {o.order_number}
                  </Link>
                </td>
                <td className="muted">{dateShort(o.placed_at)}</td>
                <td>
                  <span className={`pill ${statusPill(o.status)}`}>{o.status.replace(/_/g, " ")}</span>
                </td>
                <td>
                  <span className={`pill ${statusPill(o.payment_status)}`}>{o.payment_status.replace(/_/g, " ")}</span>
                </td>
                <td className="num">{o.item_count}</td>
                <td className="num" style={{ fontWeight: 600 }}>
                  {inr(o.grand_total)}
                </td>
              </tr>
            ))}
            {!loading && data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
