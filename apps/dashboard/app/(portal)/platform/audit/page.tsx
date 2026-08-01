"use client";

import { useEffect, useState } from "react";
import { Drawer } from "@/components/Drawer";
import { Pagination } from "@/components/Pagination";
import { dateTime } from "@/lib/format";
import { AccessDenied, ErrorCard, usePlatformApi } from "../_lib";

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  actor_user_id?: string | null;
  actor_phone?: string | null;
  payload?: unknown;
  created_at: string;
}
interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

const PAGE_SIZE = 25;

/** Compact one-line JSON preview of a payload for the table cell. */
function peek(payload: unknown): string {
  if (payload == null) return "—";
  try {
    const s = typeof payload === "string" ? payload : JSON.stringify(payload);
    return s.length > 80 ? s.slice(0, 80) + "…" : s;
  } catch {
    return "—";
  }
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  // Debounced values actually sent to the API (server-side filtering).
  const [qAction, setQAction] = useState("");
  const [qEntity, setQEntity] = useState("");
  const [view, setView] = useState<AuditEntry | null>(null);

  // Debounce the free-text filters so we don't refetch on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setQAction(action.trim());
      setQEntity(entityType.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [action, entityType]);

  const { data, loading, forbidden, failed, refetch } = usePlatformApi<Paginated<AuditEntry>>("/platform/audit", {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    action: qAction || undefined,
    entity_type: qEntity || undefined,
  });

  if (forbidden) return <AccessDenied />;
  if (failed && !data) return <ErrorCard what="the audit log" onRetry={refetch} />;

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const hasFilters = Boolean(action || entityType);

  return (
    <div>
      <div className="card pad filterbar">
        <input
          className="input fsearch"
          placeholder="Filter by action… (e.g. order.updated)"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          aria-label="Filter by action"
        />
        <input
          className="input"
          style={{ flex: "1 1 200px", minWidth: 160 }}
          placeholder="Filter by entity type… (e.g. order)"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          aria-label="Filter by entity type"
        />
        {hasFilters && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setAction("");
              setEntityType("");
            }}
          >
            Clear
          </button>
        )}
        <span className="muted small fcount">{total} entries</span>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Payload</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="empty">
                  Loading…
                </td>
              </tr>
            )}
            {!loading &&
              items.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => setView(e)}
                  onKeyDown={(ev) => ev.key === "Enter" && setView(e)}
                  tabIndex={0}
                  style={{ cursor: "pointer" }}
                >
                  <td className="muted small mono">{dateTime(e.created_at)}</td>
                  <td className="small">
                    {e.actor_phone ?? (e.actor_user_id ? e.actor_user_id.slice(0, 8) : "system")}
                  </td>
                  <td>
                    <span className="pill pill-info">{e.action}</span>
                  </td>
                  <td className="muted small">
                    {e.entity_type}
                    {e.entity_id ? ` · ${String(e.entity_id).slice(0, 8)}` : ""}
                  </td>
                  <td className="muted small mono" style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {peek(e.payload)}
                  </td>
                </tr>
              ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="empty">
                  {hasFilters ? "No audit entries match these filters." : "No audit entries yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />

      {view && (
        <Drawer
          wide
          title={view.action}
          subtitle={dateTime(view.created_at)}
          onClose={() => setView(null)}
          footer={
            <button className="btn btn-ghost" onClick={() => setView(null)}>
              Close
            </button>
          }
        >
          <dl className="drawer-dl">
            <dt>Actor</dt>
            <dd>{view.actor_phone ?? view.actor_user_id ?? "system"}</dd>
            <dt>Action</dt>
            <dd className="mono">{view.action}</dd>
            <dt>Entity</dt>
            <dd className="mono">
              {view.entity_type}
              {view.entity_id ? ` · ${view.entity_id}` : ""}
            </dd>
            <dt>When</dt>
            <dd>{dateTime(view.created_at)}</dd>
          </dl>

          <h4 className="drawer-h">Payload</h4>
          <pre
            className="mono small"
            style={{
              margin: 0,
              padding: 12,
              background: "var(--paper-3)",
              borderRadius: 10,
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {view.payload == null
              ? "—"
              : typeof view.payload === "string"
                ? view.payload
                : JSON.stringify(view.payload, null, 2)}
          </pre>
        </Drawer>
      )}
    </div>
  );
}
