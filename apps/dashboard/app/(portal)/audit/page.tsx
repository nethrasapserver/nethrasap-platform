"use client";

import { dateTime } from "@/lib/format";
import { useApi } from "@/lib/useApi";

interface AuditItem {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
}

export default function AuditPage() {
  const { data, loading } = useApi<{ items: AuditItem[] }>("/admin/audit", { limit: 100 });
  return (
    <div>
      <div className="page-head">
        <h1>Audit log</h1>
      </div>
      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th>Entity</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={3} className="empty">
                  Loading…
                </td>
              </tr>
            )}
            {data?.items.map((a) => (
              <tr key={a.id}>
                <td className="muted small">{dateTime(a.created_at)}</td>
                <td>
                  <span className="pill pill-info">{a.action}</span>
                </td>
                <td className="muted small">
                  {a.entity_type} {a.entity_id}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
