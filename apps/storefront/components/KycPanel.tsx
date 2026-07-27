"use client";

import { connectRealtime, type Schemas } from "@nethrasap/api-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { WS_BASE, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";

type Verification = Schemas["VerificationOut"];
type UploadSlot = Schemas["UploadSlotResponse"];

type DocType = "council_cert" | "cdsco_20b_21b" | "gstin" | "hospital_license";

interface DocSlot {
  type: DocType;
  label: string;
  hint: string;
  required: boolean;
}

/** The exact compliance documents each buyer type needs — mirrors the KYC doc
    types the backend accepts and the promise made by the home-page CTA. */
const SLOTS_BY_ROLE: Record<string, DocSlot[]> = {
  retailer: [
    {
      type: "cdsco_20b_21b",
      label: "Drug licence (Form 20B/21B)",
      hint: "Your pharmacy's retail/wholesale drug licence",
      required: true,
    },
    {
      type: "gstin",
      label: "GSTIN certificate",
      hint: "GST registration of the business",
      required: true,
    },
    {
      type: "hospital_license",
      label: "Institutional licence",
      hint: "Hospitals/clinics only — skip for standalone pharmacies",
      required: false,
    },
  ],
  clinician: [
    {
      type: "council_cert",
      label: "Medical council registration",
      hint: "State or national council registration certificate",
      required: true,
    },
  ],
};

const ACCEPT = "application/pdf,image/jpeg,image/png";
const MAX_BYTES = 10 * 1024 * 1024;

type SlotState =
  | { phase: "idle" }
  | { phase: "uploading"; name: string }
  | { phase: "done"; name: string; storage_key: string; content_type: string; size_bytes: number }
  | { phase: "error"; name: string; message: string };

/** KYC status + document upload for clinician/retailer accounts.
    Files go browser → storage via presigned PUT; the API never sees bytes. */
export function KycPanel() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState<Verification | null | undefined>(undefined);
  const [resubmitting, setResubmitting] = useState(false);
  const [slots, setSlots] = useState<Record<string, SlotState>>({});
  const [credentialNo, setCredentialNo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const docSlots = user ? (SLOTS_BY_ROLE[user.role] ?? []) : [];

  const reload = useCallback(async () => {
    try {
      setStatus(await api.get<Verification | null>("/kyc/status"));
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    if (user && docSlots.length > 0) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, reload]);

  // Live decision updates: the backend publishes verification.decided on the
  // user channel — flip the panel (and the account's pricing tier via
  // refresh()) the moment staff approve, no reload needed.
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!user || docSlots.length === 0) return;
    let closed = false;
    let handle: { close: () => void } | null = null;

    const connect = () => {
      connectRealtime({
        api,
        wsBase: WS_BASE,
        onEvent: (e) => {
          if (e.entity === "verification_request") {
            reload();
            if (e.type === "verification.decided") refresh();
          }
        },
        onClose: () => {
          if (!closed) retryTimer.current = setTimeout(connect, 5_000);
        },
      })
        .then((h) => {
          if (closed) h.close();
          else handle = h;
        })
        .catch(() => {
          if (!closed) retryTimer.current = setTimeout(connect, 5_000);
        });
    };
    connect();
    return () => {
      closed = true;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      handle?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user || docSlots.length === 0) return null;

  async function pickFile(slot: DocSlot, file: File | null) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setSlots((s) => ({
        ...s,
        [slot.type]: { phase: "error", name: file.name, message: "File is over 10 MB" },
      }));
      return;
    }
    setSlots((s) => ({ ...s, [slot.type]: { phase: "uploading", name: file.name } }));
    try {
      const slotResp = await api.post<UploadSlot>("/kyc/uploads", {
        doc_type: slot.type,
        content_type: file.type,
        size_bytes: file.size,
      });
      const put = await fetch(slotResp.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error(`upload failed (${put.status})`);
      setSlots((s) => ({
        ...s,
        [slot.type]: {
          phase: "done",
          name: file.name,
          storage_key: slotResp.storage_key,
          content_type: file.type,
          size_bytes: file.size,
        },
      }));
    } catch {
      setSlots((s) => ({
        ...s,
        [slot.type]: {
          phase: "error",
          name: file.name,
          message: "Upload failed — check the file and try again",
        },
      }));
    }
  }

  async function submit() {
    const documents = docSlots.flatMap((d) => {
      const s = slots[d.type];
      return s?.phase === "done"
        ? [{ doc_type: d.type, storage_key: s.storage_key, content_type: s.content_type, size_bytes: s.size_bytes }]
        : [];
    });
    setSubmitting(true);
    try {
      await api.post("/kyc/submit", {
        documents,
        credential_no: credentialNo.trim() || null,
      });
      toast("Documents submitted for verification");
      setResubmitting(false);
      setSlots({});
      await reload();
    } catch {
      toast("Could not submit — please try again", true);
    } finally {
      setSubmitting(false);
    }
  }

  const isVerified = user.status === "active";
  const pending = status?.status === "pending";
  const rejected = status?.status === "rejected";
  const showForm = !isVerified && !pending && (status === null || resubmitting);
  const allRequiredDone = docSlots
    .filter((d) => d.required)
    .every((d) => slots[d.type]?.phase === "done");

  // Still loading the status — render nothing rather than flashing the form.
  if (status === undefined && !isVerified) return null;

  if (isVerified) {
    return (
      <div className="card pad" style={{ marginTop: 16 }}>
        <div className="row spread">
          <strong>Account verified</strong>
          <span className="pill pill-ok">verified</span>
        </div>
        <p className="muted small" style={{ margin: "6px 0 0" }}>
          {user.role === "retailer" ? "Wholesale" : "Practitioner"} pricing is active on your account.
        </p>
      </div>
    );
  }

  if (pending) {
    return (
      <div className="card pad" style={{ marginTop: 16 }}>
        <div className="row spread">
          <strong>Verification under review</strong>
          <span className="pill pill-low">pending</span>
        </div>
        <p className="muted small" style={{ margin: "6px 0 0" }}>
          {status?.documents.length ?? 0} document{(status?.documents.length ?? 0) === 1 ? "" : "s"} submitted on{" "}
          {status ? new Date(status.created_at).toLocaleDateString("en-IN") : ""}. Our team usually reviews within one
          business day — this page updates automatically once decided.
        </p>
      </div>
    );
  }

  if (rejected && !resubmitting) {
    return (
      <div className="card pad" style={{ marginTop: 16, borderColor: "var(--danger, #b94824)" }}>
        <div className="row spread">
          <strong>Verification not approved</strong>
          <span className="pill pill-out">rejected</span>
        </div>
        {status?.review_notes && (
          <p className="small" style={{ margin: "8px 0 0" }}>
            Reviewer note: <em>{status.review_notes}</em>
          </p>
        )}
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setResubmitting(true)}>
          Resubmit documents
        </button>
      </div>
    );
  }

  if (!showForm) return null;

  return (
    <div className="card pad" style={{ marginTop: 16 }}>
      <strong>Verify your account to unlock {user.role} pricing</strong>
      <p className="muted small" style={{ margin: "6px 0 14px" }}>
        Upload the documents below (PDF, JPG or PNG, up to 10 MB each). Files are reviewed by our compliance team —
        typically within one business day.
      </p>

      {docSlots.map((slot) => {
        const st = slots[slot.type] ?? { phase: "idle" };
        return (
          <div key={slot.type} className="field" style={{ marginBottom: 12 }}>
            <label>
              {slot.label}
              {!slot.required && <span className="muted"> (optional)</span>}
            </label>
            <p className="muted small" style={{ margin: "2px 0 6px" }}>
              {slot.hint}
            </p>
            {st.phase === "done" ? (
              <div className="row" style={{ gap: 8 }}>
                <span className="pill pill-ok">uploaded</span>
                <span className="small">{st.name}</span>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setSlots((s) => ({ ...s, [slot.type]: { phase: "idle" } }))}
                >
                  Replace
                </button>
              </div>
            ) : (
              <>
                <input
                  className="input"
                  type="file"
                  accept={ACCEPT}
                  disabled={st.phase === "uploading"}
                  onChange={(e) => pickFile(slot, e.target.files?.[0] ?? null)}
                />
                {st.phase === "uploading" && <p className="muted small" style={{ margin: "4px 0 0" }}>Uploading {st.name}…</p>}
                {st.phase === "error" && (
                  <p className="small" style={{ margin: "4px 0 0", color: "var(--danger, #b94824)" }}>{st.message}</p>
                )}
              </>
            )}
          </div>
        );
      })}

      <div className="field" style={{ marginBottom: 14 }}>
        <label>Licence / registration number <span className="muted">(optional)</span></label>
        <input
          className="input"
          value={credentialNo}
          maxLength={100}
          placeholder={user.role === "retailer" ? "e.g. TN-20B-123456" : "e.g. TNMC 45678"}
          onChange={(e) => setCredentialNo(e.target.value)}
        />
      </div>

      <button className="btn btn-primary" disabled={!allRequiredDone || submitting} onClick={submit}>
        {submitting ? "Submitting…" : "Submit for verification"}
      </button>
      {!allRequiredDone && (
        <p className="muted small" style={{ margin: "8px 0 0" }}>
          Upload {docSlots.filter((d) => d.required).length > 1 ? "both required documents" : "the required document"} to
          submit.
        </p>
      )}
    </div>
  );
}
