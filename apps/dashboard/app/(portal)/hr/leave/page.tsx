"use client";

import { useEffect, useState } from "react";
import { Pagination, paginate } from "@/components/Pagination";
import { Select } from "@/components/Select";
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
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;
  useEffect(() => setPage(1), [status]);
  const { data, loading, refetch } = useApi<{ items: Leave[] }>(
    "/hr/leave",
    status ? { status } : undefined,
  );
  const toast = useToast();
  const rows = data?.items ?? [];
  const pageItems = paginate(rows, page, PAGE_SIZE);

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
      </div>

      <div className="card pad filterbar">
        <Select
          value={status}
          onChange={setStatus}
          options={[
            { value: "pending", label: "Pending approval" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
          ]}
          placeholder="All requests"
          ariaLabel="Leave status"
          width={180}
        />
        {status && (
          <button className="btn btn-ghost btn-sm" onClick={() => setStatus("")}>
            Clear
          </button>
        )}
        <span className="muted small fcount">{rows.length} request{rows.length === 1 ? "" : "s"}</span>
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
            {pageItems.map((l) => (
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
                <td className="num" style={{ whiteSpace: "nowrap" }}>
                  {l.status === "pending" && (
                    <>
                      <button className="btn btn-primary btn-sm" onClick={() => decide(l.id, true)}>
                        Approve
                      </button>{" "}
                      <button className="btn btn-ghost btn-sm" onClick={() => decide(l.id, false)}>
                        Reject
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  {status ? `No ${status} leave requests.` : "No leave requests yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={rows.length} pageSize={PAGE_SIZE} onPage={setPage} />
    </div>
  );
}
