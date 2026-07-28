"use client";

import { useEffect, useState } from "react";
import { KPI_ICONS, KpiRow } from "@/components/Kpi";
import { Pagination, paginate } from "@/components/Pagination";
import { Select } from "@/components/Select";
import { Drawer } from "@/components/Drawer";
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
  const [view, setView] = useState<Leave | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => setPage(1), [status]);
  // Fetch everything; the status filter applies client-side so the KPI
  // cards always reflect the full picture.
  const { data, loading, refetch } = useApi<{ items: Leave[] }>("/hr/leave");
  const toast = useToast();
  const all = data?.items ?? [];
  const rows = status ? all.filter((l) => l.status === status) : all;
  const pageItems = paginate(rows, page, pageSize);

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

      <KpiRow
        items={[
          { label: "Pending", value: all.filter((l) => l.status === "pending").length, sub: "awaiting decision", icon: KPI_ICONS.warn, tone: "clay", onClick: () => setStatus("pending"), active: status === "pending" },
          { label: "Approved", value: all.filter((l) => l.status === "approved").length, sub: "granted", icon: KPI_ICONS.check, tone: "ok", onClick: () => setStatus("approved"), active: status === "approved" },
          { label: "Rejected", value: all.filter((l) => l.status === "rejected").length, sub: "declined", icon: KPI_ICONS.warn, tone: "danger", onClick: () => setStatus("rejected"), active: status === "rejected" },
          { label: "Days requested", value: all.filter((l) => l.status === "pending").reduce((n, l) => n + l.days, 0), sub: "pending leave days", icon: KPI_ICONS.calendar, tone: "info" },
        ]}
      />

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
              <tr
                key={l.id}
                onClick={() => setView(l)}
                onKeyDown={(e) => e.key === "Enter" && setView(l)}
                tabIndex={0}
                style={{ cursor: "pointer" }}
              >
                <td className="small muted">{l.employee_id.slice(0, 8)}</td>
                <td>
                  {dateShort(l.start_date)} → {dateShort(l.end_date)}
                </td>
                <td className="num">{l.days}</td>
                <td className="muted small">{l.reason}</td>
                <td>
                  <span className={`pill ${statusPill(l.status)}`}>{l.status}</span>
                </td>
                <td className="num" style={{ whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
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

      <Pagination page={page} total={rows.length} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />

      {view && (
        <Drawer
          title="Leave request"
          subtitle={`${dateShort(view.start_date)} → ${dateShort(view.end_date)}`}
          onClose={() => setView(null)}
          footer={
            view.status === "pending" ? (
              <>
                <button className="btn btn-ghost" onClick={() => setView(null)}>Close</button>
                <button className="btn btn-danger" onClick={() => { decide(view.id, false); setView(null); }}>
                  Reject
                </button>
                <button className="btn btn-primary" onClick={() => { decide(view.id, true); setView(null); }}>
                  Approve
                </button>
              </>
            ) : (
              <button className="btn btn-ghost" onClick={() => setView(null)}>Close</button>
            )
          }
        >
          <div className="row" style={{ gap: 8, marginBottom: 16 }}>
            <span className={`pill ${statusPill(view.status)}`}>{view.status}</span>
          </div>
          <dl className="drawer-dl">
            <dt>Employee</dt>
            <dd className="mono">{view.employee_id.slice(0, 8)}</dd>
            <dt>From</dt>
            <dd>{dateShort(view.start_date)}</dd>
            <dt>To</dt>
            <dd>{dateShort(view.end_date)}</dd>
            <dt>Days</dt>
            <dd className="mono" style={{ fontWeight: 700 }}>{view.days}</dd>
            <dt>Reason</dt>
            <dd>{view.reason ?? "—"}</dd>
          </dl>
        </Drawer>
      )}
    </div>
  );
}
