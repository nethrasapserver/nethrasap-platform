"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { useApi } from "@/lib/useApi";

interface Conversation {
  id: string;
  customer_id: string;
  assigned_to: string | null;
  status: string;
  subject: string | null;
  last_message_at: string | null;
}
interface Message {
  id: string;
  sender_id: string | null;
  body: string;
  created_at: string;
}

export default function ChatInboxPage() {
  const { user } = useAuth();
  const [scope, setScope] = useState<"unassigned" | "mine" | "all">("unassigned");
  const inbox = useApi<Conversation[]>("/admin/chat/inbox", { scope });
  const [openId, setOpenId] = useState<string | null>(null);
  const [thread, setThread] = useState<{ messages: Message[] } | null>(null);
  const [body, setBody] = useState("");
  const toast = useToast();

  async function loadThread(id: string) {
    setOpenId(id);
    try {
      const c = await api.get<{ messages: Message[] }>(`/chat/conversations/${id}`);
      setThread(c);
    } catch {
      setThread({ messages: [] });
    }
  }

  // Poll the open thread every 4s for new messages.
  useEffect(() => {
    if (!openId) return;
    const t = setInterval(() => loadThread(openId), 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  async function claim(id: string) {
    await api.post(`/admin/chat/conversations/${id}/claim`);
    toast("Claimed");
    inbox.refetch();
  }
  async function send() {
    if (!openId || !body.trim()) return;
    await api.post(`/admin/chat/conversations/${openId}/messages`, { body });
    setBody("");
    loadThread(openId);
  }
  async function close(id: string) {
    await api.post(`/admin/chat/conversations/${id}/close`);
    toast("Closed");
    setOpenId(null);
    inbox.refetch();
  }

  return (
    <div>
      <div className="page-head">
        <h1>Chat inbox</h1>
        <select className="input" style={{ width: 150 }} value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
          <option value="unassigned">Unassigned</option>
          <option value="mine">Mine</option>
          <option value="all">All open</option>
        </select>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "320px 1fr", alignItems: "start" }}>
        <div className="card" style={{ overflow: "hidden" }}>
          {inbox.loading && <div className="empty">Loading…</div>}
          {inbox.data?.map((c) => (
            <div
              key={c.id}
              onClick={() => loadThread(c.id)}
              style={{
                padding: 12,
                borderBottom: "1px solid var(--line)",
                cursor: "pointer",
                background: openId === c.id ? "var(--brand-tint)" : undefined,
              }}
            >
              <div className="row spread">
                <strong className="small">{c.subject ?? "Support chat"}</strong>
                {!c.assigned_to && <span className="pill pill-warn">new</span>}
              </div>
              <div className="muted small">{c.last_message_at ? dateTime(c.last_message_at) : "—"}</div>
            </div>
          ))}
          {!inbox.loading && inbox.data?.length === 0 && <div className="empty">Inbox empty.</div>}
        </div>

        {openId && thread ? (
          <div className="card pad" style={{ display: "flex", flexDirection: "column", height: 520 }}>
            <div className="row spread" style={{ marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>Conversation</h3>
              <div className="row">
                <button className="btn btn-outline btn-sm" onClick={() => claim(openId)}>
                  Claim
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => close(openId)}>
                  Close
                </button>
              </div>
            </div>
            <div className="grow" style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {thread.messages.map((m) => {
                const mine = m.sender_id === user?.id;
                return (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: mine ? "flex-end" : "flex-start",
                      background: mine ? "var(--brand)" : "#eceee7",
                      color: mine ? "#fff" : "var(--ink)",
                      padding: "8px 12px",
                      borderRadius: 10,
                      maxWidth: "70%",
                    }}
                  >
                    <div>{m.body}</div>
                    <div style={{ fontSize: "0.68rem", opacity: 0.7, marginTop: 2 }}>{dateTime(m.created_at)}</div>
                  </div>
                );
              })}
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <input
                className="input grow"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Type a reply…"
              />
              <button className="btn btn-primary" onClick={send}>
                Send
              </button>
            </div>
          </div>
        ) : (
          <div className="card empty" style={{ height: 520, display: "grid", placeItems: "center" }}>
            Select a conversation.
          </div>
        )}
      </div>
    </div>
  );
}
