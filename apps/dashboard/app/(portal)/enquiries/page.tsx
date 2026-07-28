"use client";

import { useEffect, useState } from "react";
import { Drawer } from "@/components/Drawer";
import { KPI_ICONS, KpiRow } from "@/components/Kpi";
import { Pagination, paginate } from "@/components/Pagination";
import { Select } from "@/components/Select";
import { ApiError } from "@nethrasap/api-client";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateShort, inr, statusPill, toPaise, toRupeeInput } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { useApi } from "@/lib/useApi";

interface EItem {
  id: string;
  product_name: string;
  quantity: number;
  quoted_unit_price: number | null;
  // Allowed unit-price band (paise) — the quote must stay inside it.
  range_min: number | null;
  range_max: number | null;
}
interface Enquiry {
  id: string;
  reference: string;
  status: string;
  note: string | null;
  quoted_total: number | null;
  created_at: string;
  items: EItem[];
  approval_status: string;
}

const APPROVAL_LABEL: Record<string, string> = {
  pending: "Awaiting approval",
  returned: "Returned to sales",
  approved: "Approved",
  none: "",
};
const APPROVAL_PILL: Record<string, string> = {
  pending: "pill-warn",
  returned: "pill-err",
  approved: "pill-ok",
  none: "",
};

export default function EnquiriesPage() {
  // Filter is either a status value or "approval:pending" for the review
  // queue; both apply client-side so the KPI cards always see the full set.
  const [filter, setFilter] = useState("");
  const { data, loading, refetch } = useApi<Enquiry[]>("/admin/enquiries");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => setPage(1), [search, filter]);
  const all = data ?? [];
  const rows = all.filter((e) => {
    if (filter === "approval:pending" && e.approval_status !== "pending") return false;
    if (filter && !filter.startsWith("approval:") && e.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !e.reference.toLowerCase().includes(q) &&
        !e.items.some((i) => i.product_name.toLowerCase().includes(q))
      )
        return false;
    }
    return true;
  });
  const pageItems = paginate(rows, page, pageSize);
  const { can } = useAuth();
  const canApprove = can("enquiries:approve");
  const [drawer, setDrawer] = useState<{ enq: Enquiry; mode: "quote" | "review" } | null>(null);
  const toast = useToast();

  async function run(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast(ok);
      refetch();
    } catch {
      toast("Action failed", true);
    }
  }

  const convert = (id: string) =>
    run(async () => {
      const r = await api.post<{ order_number: string }>(`/admin/enquiries/${id}/convert`);
      toast(`Converted → ${r.order_number}`);
    }, "");
  const reject = (id: string) =>
    run(() => api.post(`/admin/enquiries/${id}/reject`, { reason: "not available" }), "Rejected");
  const approve = (id: string) =>
    run(() => api.post(`/admin/enquiries/${id}/approve`), "Quote approved & sent to customer");

  return (
    <div>
      <div className="page-head">
        <h1>Enquiries (RFQ)</h1>
      </div>

      <KpiRow
        items={[
          { label: "Enquiries", value: all.length, sub: "all time", icon: KPI_ICONS.chat, tone: "brand" },
          { label: "Pending", value: all.filter((e) => e.status === "pending").length, sub: "need a quote", icon: KPI_ICONS.warn, tone: "clay", onClick: () => setFilter("pending"), active: filter === "pending" },
          { label: "Awaiting approval", value: all.filter((e) => e.approval_status === "pending").length, sub: "drafted, not released", icon: KPI_ICONS.check, tone: "info", onClick: () => setFilter("approval:pending"), active: filter === "approval:pending" },
          { label: "Converted", value: all.filter((e) => e.status === "converted").length, sub: "became orders", icon: KPI_ICONS.orders, tone: "ok", onClick: () => setFilter("converted"), active: filter === "converted" },
        ]}
      />

      <div className="card pad filterbar">
        <input
          className="input fsearch"
          placeholder="Search reference or product…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search enquiries"
        />
        <Select
          value={filter}
          onChange={setFilter}
          options={[
            ...(canApprove ? [{ value: "approval:pending", label: "Awaiting my approval" }] : []),
            { value: "pending", label: "Pending" },
            { value: "quoted", label: "Quoted" },
            { value: "confirmed", label: "Confirmed" },
            { value: "converted", label: "Converted" },
            { value: "rejected", label: "Rejected" },
          ]}
          placeholder="All enquiries"
          ariaLabel="Enquiry status"
          width={200}
        />
        {(search || filter) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(""); setFilter(""); }}>
            Clear
          </button>
        )}
        <span className="muted small fcount">{rows.length} of {all.length}</span>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Items</th>
              <th>Submitted</th>
              <th>Status</th>
              <th className="num">Quote</th>
              <th />
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
            {pageItems.map((e) => {
              const ap = e.approval_status;
              const drafting = ap === "none" || ap === "approved";
              return (
                <tr key={e.id}>
                  <td style={{ fontWeight: 600 }}>{e.reference}</td>
                  <td className="muted small">
                    {e.items.map((i) => `${i.product_name} ×${i.quantity}`).join(", ")}
                  </td>
                  <td className="muted">{dateShort(e.created_at)}</td>
                  <td>
                    <span className={`pill ${statusPill(e.status)}`}>{e.status}</span>
                    {(ap === "pending" || ap === "returned") && (
                      <span className={`pill ${APPROVAL_PILL[ap]}`} style={{ marginLeft: 6 }}>
                        {APPROVAL_LABEL[ap]}
                      </span>
                    )}
                  </td>
                  <td className="num">{inr(e.quoted_total)}</td>
                  <td className="num" style={{ whiteSpace: "nowrap" }}>
                    {ap === "pending" && canApprove && (
                      <>
                        <button className="btn btn-primary btn-sm" onClick={() => approve(e.id)}>
                          Approve
                        </button>{" "}
                        <button className="btn btn-ghost btn-sm" onClick={() => setDrawer({ enq: e, mode: "review" })}>
                          Review
                        </button>
                      </>
                    )}
                    {ap === "pending" && !canApprove && (
                      <span className="pill pill-warn">Awaiting approval</span>
                    )}
                    {ap === "returned" && (
                      <button className="btn btn-primary btn-sm" onClick={() => setDrawer({ enq: e, mode: "quote" })}>
                        Revise quote
                      </button>
                    )}
                    {drafting && (e.status === "pending" || e.status === "quoted") && (
                      <button className="btn btn-primary btn-sm" onClick={() => setDrawer({ enq: e, mode: "quote" })}>
                        {e.status === "quoted" ? "Re-quote" : canApprove ? "Quote" : "Prepare quote"}
                      </button>
                    )}
                    {e.status === "confirmed" && (
                      <button className="btn btn-primary btn-sm" onClick={() => convert(e.id)}>
                        Convert
                      </button>
                    )}
                    {e.status === "pending" && ap === "none" && (
                      <>
                        {" "}
                        <button className="btn btn-ghost btn-sm" onClick={() => reject(e.id)}>
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  {search || filter ? "No enquiries match these filters." : "No enquiries."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={rows.length} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />

      {drawer && (
        <QuoteDrawer
          enquiry={drawer.enq}
          mode={drawer.mode}
          canApprove={canApprove}
          onClose={() => setDrawer(null)}
          onDone={() => {
            setDrawer(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function QuoteDrawer({
  enquiry,
  mode,
  canApprove,
  onClose,
  onDone,
}: {
  enquiry: Enquiry;
  mode: "quote" | "review";
  canApprove: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  // Prices are edited in rupees; the API takes integer paise.
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(enquiry.items.map((i) => [i.id, toRupeeInput(i.quoted_unit_price)])),
  );
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const total = enquiry.items.reduce((sum, i) => sum + toPaise(prices[i.id] ?? "") * i.quantity, 0);
  const lines = () => enquiry.items.map((i) => ({ item_id: i.id, unit_price: toPaise(prices[i.id] ?? "") }));

  // The unit price must sit inside the product's indicative band (mirrors the
  // backend rule). Empty prices block submit but aren't shown as an error.
  const rangeErr = (i: EItem): string | null => {
    const p = toPaise(prices[i.id] ?? "");
    if (p <= 0) return null;
    if (i.range_min != null && i.range_max != null && (p < i.range_min || p > i.range_max)) {
      return `Must be ₹${Math.round(i.range_min / 100)}–₹${Math.round(i.range_max / 100)}`;
    }
    return null;
  };
  const anyEmpty = enquiry.items.some((i) => toPaise(prices[i.id] ?? "") <= 0);
  const anyOutOfRange = enquiry.items.some((i) => rangeErr(i) != null);
  const pricesValid = !anyEmpty && !anyOutOfRange;

  async function submitQuote(successMsg: string) {
    setBusy(true);
    try {
      await api.post(`/admin/enquiries/${enquiry.id}/quote`, { lines: lines(), valid_days: 7 });
      toast(successMsg);
      onDone();
    } catch (e) {
      // Surface the backend's band message (FastAPI puts it in body.detail).
      const detail =
        e instanceof ApiError && e.body && typeof (e.body as { detail?: unknown }).detail === "string"
          ? (e.body as { detail: string }).detail
          : "Could not save the quote";
      toast(detail, true);
      setBusy(false);
    }
  }

  async function returnToSales() {
    setBusy(true);
    try {
      await api.post(`/admin/enquiries/${enquiry.id}/return`, { reason: reason.trim() || null });
      toast("Returned to sales");
      onDone();
    } catch {
      toast("Could not return the quote", true);
      setBusy(false);
    }
  }

  // In quote mode a manager releases immediately; a rep submits for approval.
  const quoteLabel = canApprove ? "Quote & send" : "Submit for approval";
  const subtitle =
    mode === "review"
      ? "Review the rep's prices, then approve or return"
      : canApprove
        ? `${enquiry.items.length} line${enquiry.items.length === 1 ? "" : "s"} · valid 7 days`
        : "A manager will review before the customer sees it";

  return (
    <Drawer
      wide
      title={`${mode === "review" ? "Approve" : "Quote"} ${enquiry.reference}`}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <>
          <span className="grow mono small" style={{ alignSelf: "center" }}>
            Total {inr(total)}
          </span>
          {mode === "review" ? (
            <>
              <button className="btn btn-ghost" onClick={returnToSales} disabled={busy}>
                {busy ? "…" : "Return to sales"}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => submitQuote("Quote approved & sent")}
                disabled={busy || !pricesValid}
              >
                {busy ? "Sending…" : "Approve & send"}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={busy || !pricesValid}
                onClick={() => submitQuote(canApprove ? "Quote sent to customer" : "Submitted for manager approval")}
              >
                {busy ? "Saving…" : quoteLabel}
              </button>
            </>
          )}
        </>
      }
    >
      {enquiry.items.map((i) => {
        const err = rangeErr(i);
        const hasBand = i.range_min != null && i.range_max != null;
        return (
          <div className="field" key={i.id}>
            <label>
              {i.product_name} <span className="muted">× {i.quantity}</span>
              {hasBand && (
                <span className="muted small" style={{ marginLeft: 6 }}>
                  · allowed ₹{Math.round(i.range_min! / 100)}–₹{Math.round(i.range_max! / 100)} / unit
                </span>
              )}
            </label>
            <div className="row" style={{ gap: 10 }}>
              <input
                className="input grow"
                inputMode="decimal"
                placeholder="Unit price (₹)"
                value={prices[i.id]}
                onChange={(e) => setPrices({ ...prices, [i.id]: e.target.value })}
                style={err ? { borderColor: "var(--danger)", boxShadow: "0 0 0 3px var(--danger-bg)" } : undefined}
              />
              <span className="mono small muted" style={{ minWidth: 90, textAlign: "right" }}>
                {inr(toPaise(prices[i.id] ?? "") * i.quantity)}
              </span>
            </div>
            {err && (
              <span className="small" style={{ color: "var(--danger)", marginTop: 4, display: "block" }}>
                Outside the allowed band — {err} per unit
              </span>
            )}
          </div>
        );
      })}
      {mode === "review" && (
        <div className="field">
          <label>Note to sales (if returning)</label>
          <textarea
            className="input"
            rows={2}
            maxLength={500}
            placeholder="e.g. margin too low on line 2 — revise"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      )}
    </Drawer>
  );
}
