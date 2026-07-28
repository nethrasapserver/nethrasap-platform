"use client";

import { useEffect, useState } from "react";
import { Pagination, paginate } from "@/components/Pagination";
import { Select } from "@/components/Select";
import { Drawer } from "@/components/Drawer";
import { api } from "@/lib/api";
import { inr, statusPill, toPaise } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { useApi } from "@/lib/useApi";

interface Employee {
  id: string;
  code: string;
  full_name: string;
  department: string;
  designation: string;
  status: string;
  basic_salary: number;
  allowances: number;
}

export default function EmployeesPage() {
  const { data, loading, refetch } = useApi<{ items: Employee[] }>("/hr/employees");
  const [add, setAdd] = useState(false);
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;
  useEffect(() => setPage(1), [query, dept]);
  const all = data?.items ?? [];
  const departments = [...new Set(all.map((e) => e.department).filter(Boolean))].sort();
  const rows = all.filter((e) => {
    if (dept && e.department !== dept) return false;
    if (query) {
      const q = query.toLowerCase();
      if (
        !e.full_name.toLowerCase().includes(q) &&
        !e.code.toLowerCase().includes(q) &&
        !e.designation.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });
  const pageItems = paginate(rows, page, PAGE_SIZE);

  return (
    <div>
      <div className="page-head">
        <h1>Employees</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setAdd(true)}>
          + Add employee
        </button>
      </div>

      <div className="card pad filterbar">
        <input
          className="input fsearch"
          placeholder="Search name / code / designation…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search employees"
        />
        <Select
          value={dept}
          onChange={setDept}
          options={departments.map((d) => ({ value: d, label: d }))}
          placeholder="All departments"
          ariaLabel="Department"
          width={180}
        />
        {(query || dept) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setQuery(""); setDept(""); }}>
            Clear
          </button>
        )}
        <span className="muted small fcount">{rows.length} of {all.length}</span>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Department</th>
              <th>Designation</th>
              <th>Status</th>
              <th className="num">Basic</th>
              <th className="num">Allowances</th>
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
            {pageItems.map((e) => (
              <tr key={e.id}>
                <td style={{ fontWeight: 600 }}>{e.code}</td>
                <td>{e.full_name}</td>
                <td className="muted">{e.department}</td>
                <td className="muted">{e.designation}</td>
                <td>
                  <span className={`pill ${statusPill(e.status)}`}>{e.status.replace(/_/g, " ")}</span>
                </td>
                <td className="num">{inr(e.basic_salary)}</td>
                <td className="num">{inr(e.allowances)}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  {query || dept ? "No employees match these filters." : "No employees yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={rows.length} pageSize={PAGE_SIZE} onPage={setPage} />

      {add && (
        <AddEmployee
          onClose={() => setAdd(false)}
          onDone={() => {
            setAdd(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function AddEmployee({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    code: "",
    full_name: "",
    department: "Sales",
    designation: "Executive",
    date_joined: "2026-01-01",
    // Rupees in the form; converted to paise on submit.
    basic_salary: "50000",
    allowances: "10000",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  const monthly = toPaise(f.basic_salary) + toPaise(f.allowances);

  async function submit() {
    setBusy(true);
    try {
      await api.post("/hr/employees", {
        ...f,
        basic_salary: toPaise(f.basic_salary),
        allowances: toPaise(f.allowances),
      });
      toast("Employee added");
      onDone();
    } catch {
      toast("Could not add employee — the code may already exist", true);
      setBusy(false);
    }
  }

  return (
    <Drawer
      title="Add employee"
      subtitle="Creates an HR record for payroll and leave."
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy || !f.code || !f.full_name} onClick={submit}>
            {busy ? "Adding…" : "Add employee"}
          </button>
        </>
      }
    >
      <div className="row">
        <div className="field grow">
          <label>Code</label>
          <input className="input" value={f.code} onChange={(e) => set("code", e.target.value)} placeholder="EMP-014" />
        </div>
        <div className="field grow">
          <label>Full name</label>
          <input className="input" value={f.full_name} onChange={(e) => set("full_name", e.target.value)} />
        </div>
      </div>
      <div className="row">
        <div className="field grow">
          <label>Department</label>
          <input className="input" value={f.department} onChange={(e) => set("department", e.target.value)} />
        </div>
        <div className="field grow">
          <label>Designation</label>
          <input className="input" value={f.designation} onChange={(e) => set("designation", e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Date joined</label>
        <input className="input" type="date" value={f.date_joined} onChange={(e) => set("date_joined", e.target.value)} />
      </div>
      <div className="row">
        <div className="field grow">
          <label>Basic salary (₹ / month)</label>
          <input className="input" inputMode="decimal" value={f.basic_salary} onChange={(e) => set("basic_salary", e.target.value)} />
        </div>
        <div className="field grow">
          <label>Allowances (₹ / month)</label>
          <input className="input" inputMode="decimal" value={f.allowances} onChange={(e) => set("allowances", e.target.value)} />
        </div>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        Gross monthly cost <strong className="mono">{inr(monthly)}</strong>
      </p>
    </Drawer>
  );
}
