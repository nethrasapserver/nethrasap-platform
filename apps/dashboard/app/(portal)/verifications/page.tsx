"use client";

import type { Schemas } from "@nethrasap/api-client";
import { useEffect, useState } from "react";
import { Drawer } from "@/components/Drawer";
import { Pagination } from "@/components/Pagination";
import { Select } from "@/components/Select";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useApi } from "@/lib/useApi";

type Verification = Schemas["VerificationOut"];
type VerificationList = Schemas["VerificationListOut"];


const STATUS_PILL: Record<string, string> = {
  pending: "pill-low",
  approved: "pill-ok",
  rejected: "pill-out",
};

const DOC_LABEL: Record<string, string> = {
  cdsco_20b_21b: "Drug licence (20B/21B)",
  gstin: "GSTIN certificate",
  council_cert: "Council registration",
  hospital_license: "Institutional licence",
};

export default function VerificationsPage() {
  const [filter, setFilter] = useState("pending");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => setPage(1), [filter]);

  const { data, loading, refetch } = useApi<VerificationList>("/verifications", {
    limit: pageSize,
    offset: (page - 1) * pageSize,
    status: filter || undefined,
  });
  const [reviewId, setReviewId] = useState<string | null>(null);

  const rows = data?.items ?? [];

  return (
    <div>
      <div className="page-head">
        <h1>Verifications</h1>
      </div>

      <div className="card pad filterbar">
        <Select
          value={filter}
          onChange={setFilter}
          options={[
            { value: "pending", label: "Pending review" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
          ]}
          placeholder="All statuses"
          ariaLabel="Verification status"
          width={180}
        />
        {filter && (
          <button className="btn btn-ghost btn-sm" onClick={() => setFilter("")}>
            Clear
          </button>
        )}
        <span className="muted small fcount">
          {data ? `${data.total} request${data.total === 1 ? "" : "s"}` : ""}
        </span>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Applicant</th>
              <th>Role</th>
              <th>Credential no.</th>
              <th className="num">Docs</th>
              <th>Submitted</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="empty">
                  Loading…
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((v) => (
                <tr key={v.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{v.applicant?.name ?? "—"}</div>
                    <div className="muted small mono">{v.applicant?.phone}</div>
                  </td>
                  <td>
                    <span className="pill pill-ink">{v.applicant?.role}</span>
                  </td>
                  <td className="mono muted">{v.credential_no ?? "—"}</td>
                  <td className="num">{v.documents.length}</td>
                  <td className="muted small">{new Date(v.created_at).toLocaleDateString("en-IN")}</td>
                  <td>
                    <span className={`pill ${STATUS_PILL[v.status] ?? "pill-ink"}`}>{v.status}</span>
                  </td>
                  <td className="num">
                    <button className="btn btn-outline btn-sm" onClick={() => setReviewId(v.id)}>
                      {v.status === "pending" ? "Review" : "View"}
                    </button>
                  </td>
                </tr>
              ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  {filter === "pending" ? "No verifications waiting — the queue is clear." : "Nothing here."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={data?.total ?? 0} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />

      {reviewId && (
        <ReviewDrawer
          requestId={reviewId}
          onClose={() => setReviewId(null)}
          onDone={() => {
            setReviewId(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

/** Detail + decision panel. Document links are short-lived presigned GETs
    minted by the detail endpoint, so always freshly fetched here. */
function ReviewDrawer({
  requestId,
  onClose,
  onDone,
}: {
  requestId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const { data: v, loading } = useApi<Verification>(`/verifications/${requestId}`);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  async function decide(action: "approve" | "reject") {
    if (action === "reject" && !notes.trim()) {
      toast("Add a note explaining the rejection — the applicant sees it", true);
      return;
    }
    setBusy(action);
    try {
      await api.post(`/verifications/${requestId}/${action}`, { notes: notes.trim() || null });
      toast(action === "approve" ? "Approved — pricing tier unlocked" : "Rejected with note");
      onDone();
    } catch {
      toast(`Could not ${action} — someone may have decided it already`, true);
      setBusy(null);
    }
  }

  const pending = v?.status === "pending";

  return (
    <Drawer
      title={pending ? "Review verification" : "Verification"}
      subtitle={v?.applicant ? `${v.applicant.name ?? v.applicant.phone} · ${v.applicant.role}` : undefined}
      onClose={onClose}
      footer={
        pending ? (
          <>
            <button className="btn btn-ghost" onClick={onClose} disabled={busy !== null}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={() => decide("reject")} disabled={busy !== null}>
              {busy === "reject" ? "Rejecting…" : "Reject"}
            </button>
            <button className="btn btn-primary" onClick={() => decide("approve")} disabled={busy !== null}>
              {busy === "approve" ? "Approving…" : "Approve"}
            </button>
          </>
        ) : undefined
      }
    >
      {loading || !v ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <dl className="drawer-dl" style={{ marginBottom: 18 }}>
            <dt>Applicant</dt>
            <dd>{v.applicant?.name ?? "—"}</dd>
            <dt>Phone</dt>
            <dd className="mono">{v.applicant?.phone}</dd>
            <dt>Requested tier</dt>
            <dd>{v.applicant?.role}</dd>
            <dt>Credential no.</dt>
            <dd className="mono">{v.credential_no ?? "—"}</dd>
            <dt>Submitted</dt>
            <dd>{new Date(v.created_at).toLocaleString("en-IN")}</dd>
            {v.reviewed_at && (
              <>
                <dt>Decided</dt>
                <dd>{new Date(v.reviewed_at).toLocaleString("en-IN")}</dd>
              </>
            )}
          </dl>

          <h4 style={{ margin: "0 0 8px" }}>Documents</h4>
          {v.documents.length === 0 && <p className="muted small">No documents attached.</p>}
          {v.documents.map((d) => (
            <div key={d.id} className="row spread" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: ".88rem" }}>{DOC_LABEL[d.doc_type] ?? d.doc_type}</div>
                <div className="muted small">
                  {d.content_type}
                  {d.size_bytes ? ` · ${Math.round(d.size_bytes / 1024)} KB` : ""}
                </div>
              </div>
              {d.download_url ? (
                <a className="btn btn-outline btn-sm" href={d.download_url} target="_blank" rel="noopener noreferrer">
                  Open
                </a>
              ) : (
                <span className="muted small">no file</span>
              )}
            </div>
          ))}

          {pending ? (
            <div className="field" style={{ marginTop: 18 }}>
              <label>Review note {`(required to reject — the applicant sees it)`}</label>
              <textarea
                className="input"
                rows={3}
                value={notes}
                maxLength={2000}
                placeholder="e.g. GSTIN certificate is illegible — please re-upload a clearer copy"
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          ) : (
            v.review_notes && (
              <div style={{ marginTop: 18 }}>
                <h4 style={{ margin: "0 0 6px" }}>Review note</h4>
                <p className="small" style={{ margin: 0 }}>{v.review_notes}</p>
              </div>
            )
          )}
        </>
      )}
    </Drawer>
  );
}
