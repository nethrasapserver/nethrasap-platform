"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { connectRealtime } from "@nethrasap/api-client";
import { WS_BASE, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { STATUS_META } from "@/lib/enquiry";
import { inr } from "@/lib/format";

interface EnquiryListItem {
  id: string;
  reference: string;
  status: string;
  quoted_total: number | null;
  quote_valid_until: string | null;
  converted_order_number: string | null;
  created_at: string;
  items: { id: string; product_name: string; quantity: number; quoted_unit_price: number | null }[];
}

export default function EnquiriesPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<EnquiryListItem[] | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await api.get<EnquiryListItem[]>("/enquiries"));
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // Quotes land in realtime — refetch when the backend announces one.
  useEffect(() => {
    if (!user) return;
    let closed = false;
    let handle: { close: () => void } | null = null;
    connectRealtime({
      api, wsBase: WS_BASE,
      onEvent: (e) => { if (e.entity === "enquiry") load(); },
    }).then((h) => (closed ? h.close() : (handle = h))).catch(() => {});
    return () => { closed = true; handle?.close(); };
  }, [user, load]);

  if (!loading && !user) {
    return (
      <div className="container section">
        <div className="card pad">
          Please <Link href="/login">sign in</Link> to see your quote requests.
        </div>
      </div>
    );
  }

  return (
    <div className="container section" style={{ maxWidth: 880 }}>
      <div className="row spread">
        <h2>My quote requests</h2>
        <Link href="/products" className="small">Browse products →</Link>
      </div>
      <p className="muted small" style={{ marginTop: 4 }}>
        Quote-priced items are priced by our sales team — you accept or negotiate before anything is charged.
      </p>

      {items === null ? (
        <div className="skeleton" style={{ height: 120, marginTop: 18 }} />
      ) : items.length === 0 ? (
        <div className="empty" style={{ marginTop: 18 }}>
          <span className="ic">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.4 8.4 0 01-9 8.4 8.6 8.6 0 01-3.9-.9L3 21l2-4.9a8.4 8.4 0 1116-4.6z" />
            </svg>
          </span>
          <b style={{ color: "var(--ink)" }}>No quote requests yet</b>
          Add a quote-priced product to your cart and send it to our team.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
          {items.map((e) => {
            const meta = STATUS_META[e.status] ?? STATUS_META.pending;
            return (
              <Link key={e.id} href={`/enquiries/${e.id}`} className="card pad enquiry-row">
                <div className="row spread" style={{ flexWrap: "wrap", gap: 8 }}>
                  <div className="row" style={{ gap: 10 }}>
                    <b className="mono">{e.reference}</b>
                    <span className={`pill ${meta.cls}`}>{meta.label}</span>
                  </div>
                  <span className="muted small">{new Date(e.created_at).toLocaleDateString("en-IN")}</span>
                </div>
                <p className="muted small" style={{ margin: "6px 0 0" }}>
                  {e.items.map((i) => `${i.product_name} × ${i.quantity}`).join(" · ")}
                </p>
                <div className="row spread" style={{ marginTop: 8 }}>
                  <span className="small muted">{meta.hint}</span>
                  {e.quoted_total != null && (
                    <b className="mono">{inr(e.quoted_total)}</b>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
