"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/api";
import { dateShort, inr, statusPill } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { useApi } from "@/lib/useApi";

interface EItem {
  id: string;
  product_name: string;
  quantity: number;
  quoted_unit_price: number | null;
}
interface Enquiry {
  id: string;
  reference: string;
  status: string;
  note: string | null;
  quoted_total: number | null;
  created_at: string;
  items: EItem[];
}

export default function EnquiriesPage() {
  const [status, setStatus] = useState("");
  const { data, loading, refetch } = useApi<Enquiry[]>("/admin/enquiries", status ? { status } : undefined);
  const [quote, setQuote] = useState<Enquiry | null>(null);
  const toast = useToast();

  async function convert(id: string) {
    try {
      const r = await api.post<{ order_number: string }>(`/admin/enquiries/${id}/convert`);
      toast(`Converted → ${r.order_number}`);
      refetch();
    } catch {
      toast("Convert failed", true);
    }
  }
  async function reject(id: string) {
    try {
      await api.post(`/admin/enquiries/${id}/reject`, { reason: "not available" });
      toast("Rejected");
      refetch();
    } catch {
      toast("Failed", true);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Enquiries (RFQ)</h1>
        <select className="input" style={{ width: 150 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
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
            {data?.map((e) => (
              <tr key={e.id}>
                <td style={{ fontWeight: 600 }}>{e.reference}</td>
                <td className="muted small">
                  {e.items.map((i) => `${i.product_name} ×${i.quantity}`).join(", ")}
                </td>
                <td className="muted">{dateShort(e.created_at)}</td>
                <td>
                  <span className={`pill ${statusPill(e.status)}`}>{e.status}</span>
                </td>
                <td className="num">{inr(e.quoted_total)}</td>
                <td className="num">
                  {(e.status === "pending" || e.status === "quoted") && (
                    <button className="btn btn-primary btn-sm" onClick={() => setQuote(e)}>
                      Quote
                    </button>
                  )}
                  {e.status === "confirmed" && (
                    <button className="btn btn-primary btn-sm" onClick={() => convert(e.id)}>
                      Convert
                    </button>
                  )}
                  {e.status === "pending" && (
                    <button className="btn btn-ghost btn-sm" onClick={() => reject(e.id)}>
                      Reject
                    </button>
                  )}
                </td>
              </tr>
            ))}
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

      {quote && (
        <QuoteModal
          enquiry={quote}
          onClose={() => setQuote(null)}
          onDone={() => {
            setQuote(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function QuoteModal({ enquiry, onClose, onDone }: { enquiry: Enquiry; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(enquiry.items.map((i) => [i.id, String(i.quoted_unit_price ?? "")])),
  );
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={`Quote ${enquiry.reference}`} onClose={onClose}>
      {enquiry.items.map((i) => (
        <div className="field" key={i.id}>
          <label>
            {i.product_name} × {i.quantity} — unit price (paise)
          </label>
          <input
            className="input"
            value={prices[i.id]}
            onChange={(e) => setPrices({ ...prices, [i.id]: e.target.value })}
          />
        </div>
      ))}
      <button
        className="btn btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api.post(`/admin/enquiries/${enquiry.id}/quote`, {
              lines: enquiry.items.map((i) => ({ item_id: i.id, unit_price: Number(prices[i.id]) })),
              valid_days: 7,
            });
            toast("Quote sent to customer");
            onDone();
          } catch {
            toast("Quote failed", true);
            setBusy(false);
          }
        }}
      >
        Send quote
      </button>
    </Modal>
  );
}
