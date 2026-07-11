"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { dateShort, statusPill } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { useApi } from "@/lib/useApi";

interface Applicant {
  id: string;
  phone: string;
  role: string;
  status: string;
  name: string | null;
}
interface KycDoc {
  id: string;
  doc_type: string;
  content_type: string;
  size_bytes: number | null;
  download_url: string;
}
interface Verification {
  id: string;
  status: string;
  credential_no: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  applicant: Applicant;
  documents: KycDoc[];
}

export default function VerificationsPage() {
  const [status, setStatus] = useState("pending");
  const { data, loading, refetch } = useApi<{ items: Verification[]; total: number }>("/verifications", { status });
  const [selected, setSelected] = useState<string | null>(null);
  const toast = useToast();

  async function decide(id: string, action: "approve" | "reject", notes: string) {
    try {
      await api.post(`/verifications/${id}/${action}`, { notes });
      toast(`Verification ${action}d`);
      setSelected(null);
      refetch();
    } catch {
      toast("Action failed", true);
    }
  }

  const detail = data?.items.find((v) => v.id === selected);

  return (
    <div>
      <div className="page-head">
        <h1>KYC verification queue</h1>
        <select className="input" style={{ width: 160 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="grid" style={{ gridTemplateColumns: selected ? "1fr 1fr" : "1fr", alignItems: "start" }}>
        <div className="card">
          <table className="tbl">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Role</th>
                <th>Submitted</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="empty">
                    Loading…
                  </td>
                </tr>
              )}
              {data?.items.map((v) => (
                <tr key={v.id} onClick={() => setSelected(v.id)} style={{ cursor: "pointer" }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{v.applicant.name ?? v.applicant.phone}</div>
                    <div className="muted small">{v.applicant.phone}</div>
                  </td>
                  <td>
                    <span className="pill pill-info">{v.applicant.role}</span>
                  </td>
                  <td className="muted">{dateShort(v.created_at)}</td>
                  <td>
                    <span className={`pill ${statusPill(v.status)}`}>{v.status}</span>
                  </td>
                </tr>
              ))}
              {!loading && data?.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty">
                    Nothing here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {detail && <ReviewPanel v={detail} onDecide={decide} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}

function ReviewPanel({
  v,
  onDecide,
  onClose,
}: {
  v: Verification;
  onDecide: (id: string, action: "approve" | "reject", notes: string) => void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState("");
  return (
    <div className="card pad">
      <div className="row spread">
        <h3 style={{ margin: 0 }}>{v.applicant.name ?? v.applicant.phone}</h3>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="muted small">
        {v.applicant.role} · {v.applicant.phone} · {v.credential_no ?? "no credential no."}
      </div>

      <h4 style={{ marginTop: 16 }}>Documents</h4>
      {v.documents.length === 0 && <div className="muted small">No documents.</div>}
      {v.documents.map((d) => (
        <a key={d.id} href={d.download_url} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm" style={{ marginRight: 8, marginBottom: 8 }}>
          {d.doc_type} ↗
        </a>
      ))}

      {v.status === "pending" ? (
        <>
          <div className="field" style={{ marginTop: 16 }}>
            <label>Review notes</label>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
          </div>
          <div className="row">
            <button className="btn btn-primary" onClick={() => onDecide(v.id, "approve", notes)}>
              Approve
            </button>
            <button className="btn btn-danger" onClick={() => onDecide(v.id, "reject", notes)}>
              Reject
            </button>
          </div>
        </>
      ) : (
        <div className="muted small" style={{ marginTop: 16 }}>
          {v.status} · {v.review_notes}
        </div>
      )}
    </div>
  );
}
