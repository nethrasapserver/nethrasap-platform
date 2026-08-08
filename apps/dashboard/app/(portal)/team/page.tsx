"use client";

import { ApiError } from "@nethrasap/api-client";
import { useEffect, useState } from "react";
import { Drawer } from "@/components/Drawer";
import { KPI_ICONS, KpiRow } from "@/components/Kpi";
import { Pagination } from "@/components/Pagination";
import { Select } from "@/components/Select";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateShort, dateTime } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { useApi } from "@/lib/useApi";

interface StaffUser {
  id: string;
  phone: string;
  name: string | null;
  role: string;
  status: string;
  phone_verified: boolean;
  last_login_at: string | null;
  created_at: string;
}
interface StaffList {
  total: number;
  items: StaffUser[];
}

const ROLES = [
  { value: "sales", label: "Sales" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
];

const ROLE_PILL: Record<string, string> = {
  admin: "pill-rx",
  manager: "pill-info",
  sales: "pill-ink",
};

const ROLE_HELP: Record<string, string> = {
  sales: "Orders, enquiries and the KYC queue for their accounts.",
  manager: "Everything sales can do, plus catalogue, content, quote approval and HR.",
  admin: "Full access, including this page and Platform Ops.",
};

const MIN_PASSWORD = 10;

/** Team — the portal accounts (sales / manager / admin).
    Staff never self-register: accounts are provisioned here by an admin. */
export default function TeamPage() {
  const { user, can } = useAuth();
  const toast = useToast();
  const manages = can("users:create");

  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<StaffUser | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 350);
    return () => clearTimeout(t);
  }, [qInput]);
  useEffect(() => setPage(1), [q, role, status]);

  const { data, loading, refetch } = useApi<StaffList>("/admin/users", {
    q: q || undefined,
    role: role || undefined,
    status: status || undefined,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  // KPIs — cheap count queries, refreshed with the list after any change.
  const kAll = useApi<StaffList>("/admin/users", { limit: 1 });
  const kAdmin = useApi<StaffList>("/admin/users", { limit: 1, role: "admin" });
  const kManager = useApi<StaffList>("/admin/users", { limit: 1, role: "manager" });
  const kSales = useApi<StaffList>("/admin/users", { limit: 1, role: "sales" });
  function refetchAll() {
    refetch();
    kAll.refetch();
    kAdmin.refetch();
    kManager.refetch();
    kSales.refetch();
  }

  const rows = data?.items ?? [];
  const hasFilters = Boolean(q || role || status);

  return (
    <div>
      <div className="page-head">
        <h1>Team</h1>
        {manages && (
          <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
            + Add staff account
          </button>
        )}
      </div>

      <KpiRow
        items={[
          { label: "Staff accounts", value: kAll.data?.total ?? "…", sub: "portal logins", icon: KPI_ICONS.people, tone: "brand" },
          { label: "Admins", value: kAdmin.data?.total ?? "…", sub: "full access", icon: KPI_ICONS.check, tone: "danger", onClick: () => setRole("admin"), active: role === "admin" },
          { label: "Managers", value: kManager.data?.total ?? "…", sub: "catalogue, approvals, HR", icon: KPI_ICONS.tag, tone: "info", onClick: () => setRole("manager"), active: role === "manager" },
          { label: "Sales", value: kSales.data?.total ?? "…", sub: "orders and enquiries", icon: KPI_ICONS.chat, tone: "clay", onClick: () => setRole("sales"), active: role === "sales" },
        ]}
      />

      <div className="card pad filterbar">
        <input
          className="input fsearch"
          placeholder="Search name or phone…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          aria-label="Search staff"
        />
        <Select
          value={role}
          onChange={setRole}
          options={ROLES}
          placeholder="All roles"
          ariaLabel="Role"
          width={160}
        />
        <Select
          value={status}
          onChange={setStatus}
          options={[
            { value: "active", label: "Active" },
            { value: "suspended", label: "Suspended" },
          ]}
          placeholder="All statuses"
          ariaLabel="Status"
          width={160}
        />
        {hasFilters && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setQInput("");
              setQ("");
              setRole("");
              setStatus("");
            }}
          >
            Clear
          </button>
        )}
        <span className="muted small fcount">
          {data ? `${data.total} account${data.total === 1 ? "" : "s"}` : ""}
        </span>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last sign-in</th>
              <th>Added</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="empty">Loading…</td>
              </tr>
            )}
            {!loading &&
              rows.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => setView(u)}
                  onKeyDown={(e) => e.key === "Enter" && setView(u)}
                  tabIndex={0}
                  style={{ cursor: "pointer" }}
                  aria-label={`View ${u.name ?? u.phone}`}
                >
                  <td style={{ fontWeight: 600 }}>
                    {u.name ?? "—"}
                    {u.id === user?.id && <span className="mini-tag t-sub" style={{ marginLeft: 6 }}>you</span>}
                  </td>
                  <td className="muted mono small">{u.phone}</td>
                  <td>
                    <span className={`pill ${ROLE_PILL[u.role] ?? "pill-ink"}`}>{u.role}</span>
                  </td>
                  <td>
                    <span className={`pill ${u.status === "active" ? "pill-ok" : "pill-out"}`}>{u.status}</span>
                  </td>
                  <td className="muted small">{u.last_login_at ? dateShort(u.last_login_at) : "never"}</td>
                  <td className="muted small">{dateShort(u.created_at)}</td>
                </tr>
              ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  {hasFilters ? "No accounts match these filters." : "No staff accounts yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        total={data?.total ?? 0}
        pageSize={pageSize}
        onPage={setPage}
        onPageSize={setPageSize}
      />

      {creating && (
        <CreateStaffDrawer
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            refetchAll();
          }}
        />
      )}

      {view && (
        <StaffDrawer
          staff={view}
          isSelf={view.id === user?.id}
          manages={manages}
          onClose={() => setView(null)}
          onChanged={(next) => {
            setView(next);
            refetchAll();
          }}
        />
      )}
    </div>
  );
}

/** Provision a new portal account. Staff sign in with phone + password —
    the password is set here and handed over out-of-band. */
function CreateStaffDrawer({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", phone: "", role: "sales", password: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const phoneDigits = form.phone.replace(/\D/g, "");
  const valid =
    form.name.trim().length >= 2 && phoneDigits.length >= 10 && form.password.length >= MIN_PASSWORD;

  async function save() {
    setBusy(true);
    try {
      await api.post("/admin/users", {
        name: form.name.trim(),
        phone: form.phone.trim(),
        role: form.role,
        password: form.password,
      });
      toast(`${form.name.trim()} can now sign in as ${form.role}`);
      onDone();
    } catch (e) {
      const detail =
        e instanceof ApiError && typeof (e.body as { detail?: unknown })?.detail === "string"
          ? (e.body as { detail: string }).detail
          : "Could not create the account";
      toast(detail, true);
      setBusy(false);
    }
  }

  return (
    <Drawer
      title="New staff account"
      subtitle="Sales, manager and admin logins are created here — they can't sign themselves up."
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={busy || !valid}>
            {busy ? "Creating…" : "Create account"}
          </button>
        </>
      }
    >
      <div className="field">
        <label>Full name<span style={{ color: "var(--danger)" }}> *</span></label>
        <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} />
      </div>

      <div className="field">
        <label>Phone<span style={{ color: "var(--danger)" }}> *</span></label>
        <input
          className="input mono"
          placeholder="+91 98450 12345"
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
        />
        <p className="muted small" style={{ margin: "6px 0 0" }}>
          This is their sign-in ID. Indian numbers can be entered with or without +91.
        </p>
      </div>

      <div className="field">
        <label>Role<span style={{ color: "var(--danger)" }}> *</span></label>
        <Select value={form.role} onChange={(v) => set("role", v || "sales")} options={ROLES} placeholder="Sales" ariaLabel="Role" />
        <p className="muted small" style={{ margin: "6px 0 0" }}>{ROLE_HELP[form.role]}</p>
      </div>

      <div className="field">
        <label>Temporary password<span style={{ color: "var(--danger)" }}> *</span></label>
        <input
          className="input"
          type="text"
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
          placeholder={`At least ${MIN_PASSWORD} characters`}
        />
        <p className="muted small" style={{ margin: "6px 0 0" }}>
          Shown in plain text so you can pass it on — share it over a private channel and ask them to
          change it after signing in.
        </p>
      </div>
    </Drawer>
  );
}

/** One staff account: details plus the admin-only actions. */
function StaffDrawer({
  staff,
  isSelf,
  manages,
  onClose,
  onChanged,
}: {
  staff: StaffUser;
  isSelf: boolean;
  manages: boolean;
  onClose: () => void;
  onChanged: (next: StaffUser) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [newRole, setNewRole] = useState(staff.role);
  const [password, setPassword] = useState("");
  const [confirmSuspend, setConfirmSuspend] = useState(false);

  async function run(fn: () => Promise<StaffUser>, ok: string) {
    setBusy(true);
    try {
      const next = await fn();
      toast(ok);
      onChanged(next);
    } catch (e) {
      const detail =
        e instanceof ApiError && typeof (e.body as { detail?: unknown })?.detail === "string"
          ? (e.body as { detail: string }).detail
          : "Action failed";
      toast(detail, true);
    } finally {
      setBusy(false);
      setConfirmSuspend(false);
    }
  }

  const suspended = staff.status === "suspended";

  return (
    <Drawer
      wide
      title={staff.name ?? staff.phone}
      subtitle={`${staff.role} · added ${dateShort(staff.created_at)}`}
      onClose={onClose}
      footer={<button className="btn btn-ghost" onClick={onClose}>Close</button>}
    >
      <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <span className={`pill ${ROLE_PILL[staff.role] ?? "pill-ink"}`}>{staff.role}</span>
        <span className={`pill ${suspended ? "pill-out" : "pill-ok"}`}>{staff.status}</span>
        {isSelf && <span className="pill pill-info">this is you</span>}
      </div>

      <dl className="drawer-dl">
        <dt>Name</dt>
        <dd><b>{staff.name ?? "—"}</b></dd>
        <dt>Phone (sign-in ID)</dt>
        <dd className="mono">{staff.phone}</dd>
        <dt>Phone verified</dt>
        <dd>{staff.phone_verified ? "Yes" : "Not yet — verifies once OTP is live"}</dd>
        <dt>Last sign-in</dt>
        <dd>{staff.last_login_at ? dateTime(staff.last_login_at) : "never signed in"}</dd>
        <dt>Added</dt>
        <dd>{dateTime(staff.created_at)}</dd>
      </dl>

      <h4 className="drawer-h">What this role can do</h4>
      <p className="small" style={{ margin: 0 }}>{ROLE_HELP[staff.role]}</p>

      {!manages ? (
        <p className="muted small" style={{ marginTop: 18 }}>
          Only admins can change roles, suspend accounts or reset passwords.
        </p>
      ) : isSelf ? (
        <p className="muted small" style={{ marginTop: 18 }}>
          You can&apos;t change your own role or suspend yourself — ask another admin. This is what stops
          the platform being locked out.
        </p>
      ) : (
        <>
          <h4 className="drawer-h">Change role</h4>
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <Select value={newRole} onChange={(v) => setNewRole(v || staff.role)} options={ROLES} placeholder="Role" ariaLabel="New role" width={180} />
            <button
              className="btn btn-outline btn-sm"
              disabled={busy || newRole === staff.role}
              onClick={() =>
                run(
                  () => api.patch<StaffUser>(`/admin/users/${staff.id}/role`, { role: newRole }),
                  `${staff.name ?? staff.phone} is now ${newRole}`,
                )
              }
            >
              Apply
            </button>
          </div>
          <p className="muted small" style={{ margin: "6px 0 0" }}>
            Takes effect on their next request — they may be asked to sign in again.
          </p>

          <h4 className="drawer-h">Reset password</h4>
          <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
            <input
              className="input"
              style={{ flex: 1 }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`New password (min ${MIN_PASSWORD} characters)`}
            />
            <button
              className="btn btn-outline btn-sm"
              disabled={busy || password.length < MIN_PASSWORD}
              onClick={() =>
                run(async () => {
                  const next = await api.post<StaffUser>(`/admin/users/${staff.id}/password`, { password });
                  setPassword("");
                  return next;
                }, "Password reset — pass it on privately")
              }
            >
              Set
            </button>
          </div>

          <h4 className="drawer-h">{suspended ? "Reactivate" : "Suspend"}</h4>
          <p className="muted small" style={{ margin: "0 0 8px" }}>
            {suspended
              ? "Restores access immediately."
              : "Blocks sign-in and every request straight away. The account and its history are kept."}
          </p>
          {suspended ? (
            <button
              className="btn btn-outline btn-sm"
              disabled={busy}
              onClick={() =>
                run(
                  () => api.patch<StaffUser>(`/admin/users/${staff.id}/status`, { suspended: false }),
                  "Account reactivated",
                )
              }
            >
              Reactivate account
            </button>
          ) : confirmSuspend ? (
            <div className="row" style={{ gap: 8 }}>
              <button
                className="btn btn-danger btn-sm"
                disabled={busy}
                onClick={() =>
                  run(
                    () => api.patch<StaffUser>(`/admin/users/${staff.id}/status`, { suspended: true }),
                    "Account suspended",
                  )
                }
              >
                Yes, suspend
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmSuspend(false)}>Cancel</button>
            </div>
          ) : (
            <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => setConfirmSuspend(true)}>
              Suspend account
            </button>
          )}
        </>
      )}
    </Drawer>
  );
}
