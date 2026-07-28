"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { KPI_ICONS, KpiRow } from "@/components/Kpi";
import { OrderDrawer } from "@/components/OrderDrawer";
import { Pagination } from "@/components/Pagination";
import { Select } from "@/components/Select";
import { api } from "@/lib/api";
import { dateShort, inr, statusPill } from "@/lib/format";
import { useToast } from "@/lib/toast";
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


const ORDER_STATUSES = [
  "placed",
  "confirmed",
  "packed",
  "dispatched",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "refunded",
  "payment_failed",
];
const PAYMENT_STATUSES = [
  "cod_pending",
  "pending",
  "authorized",
  "captured",
  "failed",
  "refunded",
  "partial_refund",
];

const label = (s: string) => s.replace(/_/g, " ");

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="card empty">Loading…</div>}>
      <OrdersInner />
    </Suspense>
  );
}

function OrdersInner() {
  const toast = useToast();
  // Filters. `qInput` is what's typed; `q` is the debounced value that queries.
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [payment, setPayment] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // Deep-linkable: /orders?open=NS-2026-00015 opens that order's drawer.
  const [openOrder, setOpenOrder] = useState<string | null>(useSearchParams().get("open"));
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 350);
    return () => clearTimeout(t);
  }, [qInput]);

  // Any filter change goes back to page 1.
  useEffect(() => setPage(1), [q, status, payment, from, to]);

  const filters = {
    q: q || undefined,
    status: status || undefined,
    payment_status: payment || undefined,
    date_from: from || undefined,
    date_to: to || undefined,
  };
  const { data, loading, refetch } = useApi<{ items: AdminOrder[]; total: number }>("/admin/orders", {
    ...filters,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  // Page KPIs — cheap count queries (limit=1, read total), independent of the
  // filters, refreshed together with the list after any drawer action.
  const kTotal = useApi<{ total: number }>("/admin/orders", { limit: 1 });
  const kFulfil = useApi<{ total: number }>("/admin/orders", { limit: 1, status: "confirmed" });
  const kTransit = useApi<{ total: number }>("/admin/orders", { limit: 1, status: "dispatched" });
  const kDelivered = useApi<{ total: number }>("/admin/orders", { limit: 1, status: "delivered" });
  function refetchAll() {
    refetch();
    kTotal.refetch();
    kFulfil.refetch();
    kTransit.refetch();
    kDelivered.refetch();
  }

  const hasFilters = Boolean(q || status || payment || from || to);

  function clearFilters() {
    setQInput("");
    setQ("");
    setStatus("");
    setPayment("");
    setFrom("");
    setTo("");
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const full = await api.get<{ items: AdminOrder[]; total: number }>("/admin/orders", {
        ...filters,
        limit: 200,
      });
      const rows = [
        ["Order", "Customer", "Phone", "Placed", "Status", "Payment", "Items", "Total (₹)"],
        ...full.items.map((o) => [
          o.order_number,
          o.customer_name,
          o.customer_phone,
          new Date(o.placed_at).toLocaleDateString("en-IN"),
          o.status,
          o.payment_status,
          String(o.item_count),
          (o.grand_total / 100).toFixed(2),
        ]),
      ];
      const csv = rows
        .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","))
        .join("\n");
      const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `nethrasap-orders-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      if (full.total > full.items.length) {
        toast(`Exported the first ${full.items.length} of ${full.total} — narrow the filters for the rest`);
      } else {
        toast(`Exported ${full.items.length} orders`);
      }
    } catch {
      toast("Export failed", true);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Orders</h1>
        <div className="row" style={{ gap: 10 }}>
          <span className="muted small" style={{ alignSelf: "center" }}>
            {data ? `${data.total} order${data.total === 1 ? "" : "s"}` : ""}
          </span>
          <button className="btn btn-outline btn-sm" onClick={exportCsv} disabled={exporting || !data?.total}>
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </div>

      <KpiRow
        items={[
          { label: "Total orders", value: kTotal.data?.total ?? "…", sub: "all time", icon: KPI_ICONS.orders, tone: "brand" },
          { label: "To fulfil", value: kFulfil.data?.total ?? "…", sub: "confirmed, awaiting dispatch", icon: KPI_ICONS.box, tone: "clay" },
          { label: "In transit", value: kTransit.data?.total ?? "…", sub: "dispatched", icon: KPI_ICONS.truck, tone: "info" },
          { label: "Delivered", value: kDelivered.data?.total ?? "…", sub: "completed sales", icon: KPI_ICONS.check, tone: "ok" },
        ]}
      />

      {/* Filter toolbar */}
      <div className="card pad filterbar">
        <input
          className="input fsearch"
          placeholder="Search order no. / phone / name…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          aria-label="Search orders"
        />
        <Select
          value={status}
          onChange={setStatus}
          options={ORDER_STATUSES.map((s) => ({ value: s, label: label(s) }))}
          placeholder="All statuses"
          ariaLabel="Order status"
          width={170}
        />
        <Select
          value={payment}
          onChange={setPayment}
          options={PAYMENT_STATUSES.map((s) => ({ value: s, label: label(s) }))}
          placeholder="All payments"
          ariaLabel="Payment status"
          width={170}
        />
        <div className="row" style={{ gap: 6, alignItems: "center" }}>
          <input className="input" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
          <span className="muted small">→</span>
          <input className="input" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
        </div>
        {hasFilters && (
          <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
            Clear
          </button>
        )}
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
            {!loading &&
              data?.items.map((o) => (
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
                    <span className={`pill ${statusPill(o.status)}`}>{label(o.status)}</span>
                  </td>
                  <td>
                    <span className={`pill ${statusPill(o.payment_status)}`}>{label(o.payment_status)}</span>
                  </td>
                  <td className="num">{o.item_count}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{inr(o.grand_total)}</td>
                </tr>
              ))}
            {!loading && data?.items.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  {hasFilters ? "No orders match these filters." : "No orders yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={data?.total ?? 0} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />

      {openOrder && (
        <OrderDrawer orderNumber={openOrder} onClose={() => setOpenOrder(null)} onChanged={refetchAll} />
      )}
    </div>
  );
}
