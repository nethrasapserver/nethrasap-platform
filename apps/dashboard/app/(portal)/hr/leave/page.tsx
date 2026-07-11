"use client";

import { api } from "@/lib/api";
import { dateShort, statusPill } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { useApi } from "@/lib/useApi";

interface Leave {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: string;
}

export default function LeavePage() {
  const { data, loading, refetch } = useApi<{ items: Leave[] }>("/hr/leave", { status: "pending" });
  const toast = useToast();

  async function decide(id: string, approve: boolean) {
    try {
      await api.post(`/hr/leave/${id}/decision`, { approve, note: approve ? "approved" : "declined" });
      toast(approve ? "Approved" : "Rejected");
      refetch();
    } catch {
      toast("Failed", true);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Leave requests</h1>
        <span className="muted small">Pending approvals</span>
      </div>
      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Dates</th>
              <th className="num">Days</th>
              <th>Reason</th>
              <th>Status</th>
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
            {data?.items.map((l) => (
              <tr key={l.id}>
                <td className="small muted">{l.employee_id.slice(0, 8)}</td>
                <td>
                  {dateShort(l.start_date)} → {dateShort(l.end_date)}
                </td>
                <td className="num">{l.days}</td>
                <td className="muted small">{l.reason}</td>
                <td>
                  <span className={`pill ${statusPill(l.status)}`}>{l.status}</span>
                </td>
                <td className="num">
                  <button className="btn btn-primary btn-sm" onClick={() => decide(l.id, true)}>
                    Approve
                  </button>{" "}
                  <button className="btn btn-ghost btn-sm" onClick={() => decide(l.id, false)}>
                    Reject
                  </button>
                </td>
              </tr>
            ))}
            {!loading && data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  No pending leave requests.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
