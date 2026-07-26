"use client";

import { useState } from "react";
import { Drawer } from "@/components/Drawer";
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
  // Filter is either a status value or "approval:pending" for the review queue.
  const [filter, setFilter] = useState("");
  const query = filter.startsWith("approval:")
    ? { approval: filter.slice("approval:".length) }
    : filter
      ? { status: filter }
      : undefined;
  const { data, loading, refetch } = useApi<Enquiry[]>("/admin/enquiries", query);
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
        <select className="input" style={{ width: 190 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All</option>
          {canApprove && <option value="approval:pending">Awaiting my approval</option>}
          <option value="pending">Pending</option>
          <option value="quoted">Quoted</option>
          <option value="confirmed">Confirmed</option>
          <option value="converted">Converted</option>
        </select>
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
            {data?.map((e) => {
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
            {!loading && data?.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  No enquiries.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
