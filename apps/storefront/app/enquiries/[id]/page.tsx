"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { connectRealtime } from "@nethrasap/api-client";
import { WS_BASE, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { inr } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { STATUS_META } from "@/lib/enquiry";

interface EnquiryDetail {
  id: string;
  reference: string;
  status: string;
  customer_id: string;
  note: string | null;
  quoted_total: number | null;
  quote_valid_until: string | null;
  converted_order_number: string | null;
  created_at: string;
  items: { id: string; product_name: string; quantity: number; quoted_unit_price: number | null }[];
  messages: { id: string; sender_id: string; body: string; created_at: string }[] | null;
  history: { status: string; note: string | null; at: string }[] | null;
}

export default function EnquiryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const toast = useToast();
  const [enq, setEnq] = useState<EnquiryDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const threadEnd = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setEnq(await api.get<EnquiryDetail>(`/enquiries/${id}`));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [id]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // Live thread: refetch when the rep quotes or replies.
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

  useEffect(() => {
    threadEnd.current?.scrollIntoView({ block: "nearest" });
  }, [enq?.messages?.length]);

  async function send() {
    if (!msg.trim()) return;
    setBusy(true);
    try {
      setEnq(await api.post<EnquiryDetail>(`/enquiries/${id}/messages`, { body: msg.trim() }));
      setMsg("");
    } catch {
      toast("Could not send your message", true);
    } finally {
      setBusy(false);
    }
  }

  async function accept() {
    setBusy(true);
    try {
      setEnq(await api.post<EnquiryDetail>(`/enquiries/${id}/accept`, {}));
      toast("Quote accepted — we'll confirm your order shortly");
    } catch {
      toast("Could not accept the quote", true);
    } finally {
      setBusy(false);
    }
  }

  if (!loading && !user) {
    return (
      <div className="container section">
        <div className="card pad">Please <Link href="/login">sign in</Link> to view this enquiry.</div>
      </div>
    );
  }
  if (failed) {
    return (
      <div className="container section">
        <div className="card pad">
          We couldn&apos;t find that enquiry. <Link href="/enquiries">Back to quote requests</Link>
        </div>
      </div>
    );
  }
  if (!enq) return <div className="container section muted">Loading enquiry…</div>;

  const meta = STATUS_META[enq.status] ?? STATUS_META.pending;
  const quoteExpired =
    enq.status === "quoted" && enq.quote_valid_until != null &&
    new Date(enq.quote_valid_until).getTime() < Date.now();

  return (
    <div className="container section" style={{ maxWidth: 980 }}>
      <nav className="small muted" style={{ marginBottom: 12 }} aria-label="Breadcrumb">
        <Link href="/enquiries">Quote requests</Link> · {enq.reference}
      </nav>

      <div className="row spread" style={{ flexWrap: "wrap", gap: 10 }}>
        <h2 className="mono" style={{ margin: 0 }}>{enq.reference}</h2>
        <span className={`pill ${meta.cls}`}>{meta.label}</span>
      </div>

      <div className="two-col" style={{ marginTop: 16 }}>
        <div style={{ display: "grid", gap: 16 }}>
          {/* Items — quoted unit prices appear once the rep sends them. */}
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th style={{ textAlign: "right" }}>Quoted price</th>
                  <th style={{ textAlign: "right" }}>Line</th>
                </tr>
              </thead>
              <tbody>
                {enq.items.map((it) => (
                  <tr key={it.id}>
                    <td style={{ fontWeight: 600 }}>{it.product_name}</td>
                    <td>{it.quantity}</td>
                    <td style={{ textAlign: "right" }} className="mono">
                      {it.quoted_unit_price != null ? inr(it.quoted_unit_price) : "—"}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600 }} className="mono">
                      {it.quoted_unit_price != null ? inr(it.quoted_unit_price * it.quantity) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Conversation with the sales team */}
          <div className="card">
            <div className="panel-head"><h3>Conversation</h3></div>
            <div className="thread">
              {enq.note && (
                <div className="msg is-mine">
                  <p>{enq.note}</p>
                  <span>Your note · {new Date(enq.created_at).toLocaleString("en-IN")}</span>
                </div>
              )}
              {(enq.messages ?? []).map((m) => {
                const mine = m.sender_id === user?.id;
                return (
                  <div key={m.id} className={`msg ${mine ? "is-mine" : ""}`}>
                    <p>{m.body}</p>
                    <span>{mine ? "You" : "Nethrasap sales"} · {new Date(m.created_at).toLocaleString("en-IN")}</span>
                  </div>
                );
              })}
              {(enq.messages ?? []).length === 0 && !enq.note && (
                <p className="muted small" style={{ padding: 16, margin: 0 }}>
                  No messages yet — use the box below to negotiate or add details.
                </p>
              )}
              <div ref={threadEnd} />
            </div>
            {enq.status !== "rejected" && enq.status !== "converted" && (
              <div className="pad row" style={{ borderTop: "1px solid var(--line)", gap: 10 }}>
                <input
                  className="input grow"
                  placeholder="Ask a question or make a counter-offer…"
                  value={msg}
                  maxLength={4000}
                  onChange={(e) => setMsg(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                />
                <button className="btn btn-primary" disabled={busy || !msg.trim()} onClick={send}>
                  Send
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Quote panel */}
        <div className="card pad summary-card" style={{ display: "grid", gap: 12, alignSelf: "start" }}>
          <h3>Quote</h3>
          {enq.status === "pending" && (
            <p className="muted small" style={{ margin: 0 }}>
              Our team is pricing your request — you&apos;ll be notified the moment the quote is ready.
            </p>
          )}
          {enq.quoted_total != null && (
            <>
              <div className="row spread">
                <span className="muted">Quoted total</span>
                <b className="mono" style={{ fontSize: "1.3rem" }}>{inr(enq.quoted_total)}</b>
              </div>
              {enq.quote_valid_until && (
                <p className="small muted" style={{ margin: 0 }}>
                  Valid until {new Date(enq.quote_valid_until).toLocaleDateString("en-IN")}
                  {quoteExpired && <b style={{ color: "var(--danger)" }}> — expired, message us to re-quote</b>}
                </p>
              )}
            </>
          )}
          {enq.status === "quoted" && !quoteExpired && (
            <>
              <button className="btn btn-primary btn-block" disabled={busy} onClick={accept}>
                {busy ? "Accepting…" : "Accept quote"}
              </button>
              <p className="small muted" style={{ margin: 0 }}>
                Not right? Reply in the conversation to negotiate — nothing is charged until you accept
                and the order is confirmed (COD).
              </p>
            </>
          )}
          {enq.status === "confirmed" && (
            <p className="small" style={{ margin: 0 }}>
              ✓ Accepted. Our team is converting this into an order — it will appear in{" "}
              <Link href="/account">your orders</Link>.
            </p>
          )}
          {enq.status === "converted" && enq.converted_order_number && (
            <Link href={`/orders/${enq.converted_order_number}`} className="btn btn-primary btn-block">
              View order {enq.converted_order_number}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
