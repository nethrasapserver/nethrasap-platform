"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { connectRealtime } from "@nethrasap/api-client";
import { WS_BASE, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { STATUS_META } from "@/lib/enquiry";
import { inr } from "@/lib/format";

/* A rule-based assistant — no LLM, no navigating away. Every answer is rendered
   inside the panel: order status is explained with a live timeline, quote and
   support threads are two-way live chats. Signed-out visitors log in first. */

type Screen = "flow" | "enquiry";

interface OrderRow {
  order_number: string;
  status: string;
  grand_total: number;
}
interface OrderDetail extends OrderRow {
  payment_status: string;
  placed_at: string;
  status_history: { status: string; note: string | null; at: string }[];
}
interface QuoteRow {
  id: string;
  reference: string;
  status: string;
  quoted_total: number | null;
}
interface EnquiryDetail {
  id: string;
  reference: string;
  status: string;
  quoted_total: number | null;
  quote_valid_until: string | null;
  note: string | null;
  created_at: string;
  items: { id: string; product_name: string; quantity: number; quoted_unit_price: number | null }[];
  messages: { id: string; sender_id: string; body: string; created_at: string }[] | null;
}
type Turn =
  | { id: number; role: "bot" | "user"; kind: "text"; text: string }
  | { id: number; role: "bot"; kind: "menu" }
  | { id: number; role: "bot"; kind: "orders"; orders: OrderRow[] }
  | { id: number; role: "bot"; kind: "orderStatus"; order: OrderDetail }
  | { id: number; role: "bot"; kind: "quotes"; quotes: QuoteRow[] };

const ORDER_EXPLAIN: Record<string, string> = {
  pending: "We've received your order — it's awaiting confirmation from our team.",
  confirmed: "Your order is confirmed and being prepared for dispatch.",
  processing: "We're packing your order right now.",
  packed: "Your order is packed and ready to leave our facility.",
  shipped: "Your order has shipped and is on its way to you.",
  out_for_delivery: "Your order is out for delivery and should arrive shortly.",
  delivered: "This order was delivered. We hope everything's perfect!",
  cancelled: "This order was cancelled. Message us if that's unexpected.",
  returned: "This order was returned.",
};
const PAYMENT_NOTE: Record<string, string> = {
  cod_pending: "Cash on delivery — pay when your order arrives.",
  paid: "Payment received. Thank you!",
  captured: "Payment received. Thank you!",
  refunded: "This payment was refunded.",
};

const pretty = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function ChatBot() {
  const { user, loading } = useAuth();
  const { count } = useCart();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<Screen>("flow");

  // Rule-based conversation thread.
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const idRef = useRef(0);
  const nextId = () => ++idRef.current;

  // Live enquiry chat (WS-backed).
  const [enq, setEnq] = useState<EnquiryDetail | null>(null);
  const [enqInput, setEnqInput] = useState("");

  const bodyRef = useRef<HTMLDivElement>(null);
  const hidden = pathname.startsWith("/login") || pathname.startsWith("/signup");

  const seedGreeting = useCallback((name: string) => {
    setTurns([
      { id: nextId(), role: "bot", kind: "text", text: `Hi ${name}! I'm your Nethra assistant. How can I help today?` },
      { id: nextId(), role: "bot", kind: "menu" },
    ]);
  }, []);

  // Fresh conversation each time it opens.
  useEffect(() => {
    if (!open) return;
    setScreen("flow");
    setEnq(null);
    if (user) seedGreeting(user.profile?.full_name?.split(" ")[0] || "there");
  }, [open, user, seedGreeting]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, screen, enq?.messages?.length]);

  const push = (...t: Turn[]) => setTurns((prev) => [...prev, ...t]);
  const botText = (text: string): Turn => ({ id: nextId(), role: "bot", kind: "text", text });
  const userText = (text: string): Turn => ({ id: nextId(), role: "user", kind: "text", text });

  // ---- Flow actions ----
  async function pickOrders() {
    push(userText("Check order status"));
    setBusy(true);
    try {
      const r = await api.get<{ items: OrderRow[] }>("/orders");
      push(
        r.items?.length
          ? { id: nextId(), role: "bot", kind: "orders", orders: r.items }
          : botText("You don't have any orders yet — once you place one, its status will show up here."),
      );
      if (!r.items?.length) push({ id: nextId(), role: "bot", kind: "menu" });
    } catch {
      push(botText("Sorry, I couldn't load your orders just now."));
    } finally {
      setBusy(false);
    }
  }

  async function pickOrder(o: OrderRow) {
    push(userText(o.order_number));
    setBusy(true);
    try {
      const d = await api.get<OrderDetail>(`/orders/${o.order_number}`);
      push({ id: nextId(), role: "bot", kind: "orderStatus", order: d });
      push(botText("Anything else I can help with?"), { id: nextId(), role: "bot", kind: "menu" });
    } catch {
      push(botText("I couldn't open that order — please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function pickQuotes() {
    push(userText("Quote responses"));
    setBusy(true);
    try {
      const r = await api.get<QuoteRow[]>("/enquiries");
      push(
        r?.length
          ? botText("Which quote would you like to look at?")
          : botText("You have no quote requests yet. Add a quote-priced item to your cart to request one."),
      );
      if (r?.length) push({ id: nextId(), role: "bot", kind: "quotes", quotes: r });
      else push({ id: nextId(), role: "bot", kind: "menu" });
    } catch {
      push(botText("Sorry, I couldn't load your quotes just now."));
    } finally {
      setBusy(false);
    }
  }

  async function openEnquiry(q: QuoteRow) {
    setEnq(null);
    setScreen("enquiry");
    setBusy(true);
    await loadEnq(q.id);
    setBusy(false);
  }

  const loadEnq = useCallback(async (id: string) => {
    try {
      setEnq(await api.get<EnquiryDetail>(`/enquiries/${id}`));
    } catch {
      /* keep */
    }
  }, []);

  // Enquiry realtime (customer IS on their user channel for enquiry events).
  useEffect(() => {
    if (screen !== "enquiry" || !enq) return;
    const id = enq.id;
    let closed = false;
    let handle: { close: () => void } | null = null;
    connectRealtime({ api, wsBase: WS_BASE, onEvent: (e) => { if (e.entity === "enquiry") loadEnq(id); } })
      .then((h) => (closed ? h.close() : (handle = h)))
      .catch(() => {});
    return () => { closed = true; handle?.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, enq?.id, loadEnq]);

  async function sendEnq() {
    const body = enqInput.trim();
    if (!body || !enq) return;
    setBusy(true);
    try {
      setEnq(await api.post<EnquiryDetail>(`/enquiries/${enq.id}/messages`, { body }));
      setEnqInput("");
    } finally {
      setBusy(false);
    }
  }
  async function acceptQuote() {
    if (!enq) return;
    setBusy(true);
    try {
      setEnq(await api.post<EnquiryDetail>(`/enquiries/${enq.id}/accept`, {}));
    } finally {
      setBusy(false);
    }
  }

  if (hidden) return null;

  const cartBarVisible = count > 0 && pathname !== "/cart" && pathname !== "/checkout";
  const raised = cartBarVisible ? "true" : "false";

  function backToFlow() {
    setScreen("flow");
    setEnq(null);
  }

  return (
    <>
      {!open && (
        <button className="chatbot-fab" data-raised={raised} aria-label="Open chat assistant" onClick={() => setOpen(true)}>
          <ChatGlyph />
          <span className="chatbot-fab-dot" />
        </button>
      )}

      {open && (
        <div className="chatbot-panel" data-raised={raised} role="dialog" aria-label="Chat assistant">
          <header className="chatbot-head">
            <span className="chatbot-head-wrap">
              <span className="chatbot-head-title">Nethra Assistant</span>
              <span className="chatbot-head-sub">Orders · Quotes · Support</span>
            </span>
            <button className="chatbot-x" aria-label="Close chat" onClick={() => setOpen(false)}>✕</button>
          </header>

          <div className="chatbot-body" ref={bodyRef}>
            {loading ? (
              <div className="chatbot-bubble">One moment…</div>
            ) : !user ? (
              <>
                <div className="chatbot-bubble">Hi there! Please log in so I can help with your orders and quotes.</div>
                <div className="chatbot-opts">
                  <Link href="/login" className="chatbot-opt is-cta" onClick={() => setOpen(false)}>Log in to chat</Link>
                </div>
              </>
            ) : screen === "enquiry" ? (
              <EnquiryChat
                enq={enq} busy={busy} userId={user.id} input={enqInput}
                setInput={setEnqInput} onSend={sendEnq} onAccept={acceptQuote} onBack={backToFlow}
              />
            ) : (
              <>
                {turns.map((t) => (
                  <FlowTurn
                    key={t.id}
                    turn={t}
                    busy={busy}
                    onOrders={pickOrders}
                    onQuotes={pickQuotes}
                    onPickOrder={pickOrder}
                    onPickQuote={openEnquiry}
                  />
                ))}
                {busy && <div className="chatbot-typing"><span /><span /><span /></div>}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function FlowTurn({
  turn, busy, onOrders, onQuotes, onPickOrder, onPickQuote,
}: {
  turn: Turn;
  busy: boolean;
  onOrders: () => void;
  onQuotes: () => void;
  onPickOrder: (o: OrderRow) => void;
  onPickQuote: (q: QuoteRow) => void;
}) {
  if (turn.kind === "text") {
    return <div className={`chatbot-bubble ${turn.role === "user" ? "is-mine" : ""}`}>{turn.text}</div>;
  }
  if (turn.kind === "menu") {
    return (
      <div className="chatbot-menu">
        <button className="chatbot-menucard" disabled={busy} onClick={onOrders}>
          <b>Track an order</b>
          <span>See where your order is</span>
        </button>
        <button className="chatbot-menucard" disabled={busy} onClick={onQuotes}>
          <b>Quote responses</b>
          <span>Chat about your quote requests</span>
        </button>
      </div>
    );
  }
  if (turn.kind === "orders") {
    return (
      <div className="chatbot-cardlist">
        {turn.orders.slice(0, 6).map((o) => (
          <button key={o.order_number} className="chatbot-card" disabled={busy} onClick={() => onPickOrder(o)}>
            <div className="chatbot-card-top">
              <b>{o.order_number}</b>
              <span className="chatbot-pill">{pretty(o.status)}</span>
            </div>
            <span className="chatbot-card-sub">{inr(o.grand_total)} · tap for status</span>
          </button>
        ))}
      </div>
    );
  }
  if (turn.kind === "quotes") {
    return (
      <div className="chatbot-cardlist">
        {turn.quotes.slice(0, 8).map((q) => {
          const meta = STATUS_META[q.status];
          return (
            <button key={q.id} className="chatbot-card" disabled={busy} onClick={() => onPickQuote(q)}>
              <div className="chatbot-card-top">
                <b>{q.reference}</b>
                <span className="chatbot-pill">{meta?.label ?? q.status}</span>
              </div>
              <span className="chatbot-card-sub">
                {q.status === "quoted" && q.quoted_total ? `${inr(q.quoted_total)} · ` : ""}
                {meta?.hint ?? "open chat"}
              </span>
            </button>
          );
        })}
      </div>
    );
  }
  // orderStatus
  const o = turn.order;
  const explain = ORDER_EXPLAIN[o.status] ?? `Current status: ${pretty(o.status)}.`;
  const payNote = PAYMENT_NOTE[o.payment_status];
  const steps = [...(o.status_history ?? [])].slice(-5);
  return (
    <div className="chatbot-status">
      <div className="chatbot-card-top">
        <b>{o.order_number}</b>
        <span className="chatbot-pill">{pretty(o.status)}</span>
      </div>
      <p className="chatbot-status-text">{explain}</p>
      {steps.length > 0 && (
        <ol className="chatbot-timeline">
          {steps.map((s, i) => (
            <li key={i} className={i === steps.length - 1 ? "is-now" : ""}>
              <span className="chatbot-tdot" />
              <span className="chatbot-tlabel">{pretty(s.status)}</span>
              <span className="chatbot-ttime">{new Date(s.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="chatbot-status-foot">
        <span>Total {inr(o.grand_total)}</span>
        {payNote && <span className="muted">{payNote}</span>}
      </div>
      <Link href={`/orders/${o.order_number}`} className="chatbot-inlinelink">Open full order & tracking →</Link>
    </div>
  );
}

function Thread({ children }: { children: React.ReactNode }) {
  return <div className="chatbot-thread">{children}</div>;
}

function EnquiryChat({
  enq, busy, userId, input, setInput, onSend, onAccept, onBack,
}: {
  enq: EnquiryDetail | null;
  busy: boolean;
  userId: string;
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  onAccept: () => void;
  onBack: () => void;
}) {
  if (!enq) {
    return (<><BackRow onBack={onBack} /><div className="chatbot-typing"><span /><span /><span /></div></>);
  }
  const meta = STATUS_META[enq.status] ?? STATUS_META.pending;
  const closed = enq.status === "rejected" || enq.status === "converted";
  const expired =
    enq.status === "quoted" && enq.quote_valid_until != null &&
    new Date(enq.quote_valid_until).getTime() < Date.now();
  return (
    <>
      <BackRow onBack={onBack} label="Back to menu" />
      <div className="chatbot-quotehdr">
        <div className="chatbot-card-top">
          <b>{enq.reference}</b>
          <span className="chatbot-pill">{meta.label}</span>
        </div>
        {enq.quoted_total != null && (
          <div className="chatbot-quote-total">Quoted total <b>{inr(enq.quoted_total)}</b></div>
        )}
        {enq.status === "quoted" && !expired && (
          <button className="chatbot-opt is-cta" disabled={busy} onClick={onAccept}>
            {busy ? "…" : "Accept quote"}
          </button>
        )}
      </div>
      <Thread>
        {enq.note && (
          <div className="chatbot-bubble is-mine">{enq.note}<span className="chatbot-bubble-meta">Your note</span></div>
        )}
        {(enq.messages ?? []).map((m) => {
          const mine = m.sender_id === userId;
          return (
            <div key={m.id} className={`chatbot-bubble ${mine ? "is-mine" : ""}`}>
              {m.body}
              <span className="chatbot-bubble-meta">
                {mine ? "You" : "Nethrasap sales"} · {new Date(m.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          );
        })}
        {(enq.messages ?? []).length === 0 && !enq.note && (
          <div className="chatbot-note">No messages yet — say hello or make a counter-offer below.</div>
        )}
      </Thread>
      {!closed && (
        <Composer input={input} setInput={setInput} onSend={onSend} busy={busy} placeholder="Type a message…" />
      )}
    </>
  );
}

function Composer({
  input, setInput, onSend, busy, placeholder,
}: {
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  busy: boolean;
  placeholder: string;
}) {
  return (
    <div className="chatbot-compose">
      <input
        className="chatbot-compose-input"
        placeholder={placeholder}
        value={input}
        maxLength={4000}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
      />
      <button className="chatbot-send" disabled={busy || !input.trim()} onClick={onSend} aria-label="Send">Send</button>
    </div>
  );
}

function ChatGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.4 8.4 0 01-9 8.4 8.6 8.6 0 01-3.9-.9L3 21l2-4.9a8.4 8.4 0 1116-4.6z" />
    </svg>
  );
}

function BackRow({ onBack, label = "Back" }: { onBack: () => void; label?: string }) {
  return <button className="chatbot-back" onClick={onBack}>← {label}</button>;
}
