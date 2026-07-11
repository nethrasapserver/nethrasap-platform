"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/api";
import { inr, statusPill } from "@/lib/format";
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

  return (
    <div>
      <div className="page-head">
        <h1>Employees</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setAdd(true)}>
          + Add employee
        </button>
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
            {data?.items.map((e) => (
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
            {!loading && data?.items.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  No employees yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
    basic_salary: "5000000",
    allowances: "1000000",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  return (
    <Modal title="Add employee" onClose={onClose}>
      <div className="row">
        <div className="field grow">
          <label>Code</label>
          <input className="input" value={f.code} onChange={(e) => set("code", e.target.value)} />
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
      <div className="row">
        <div className="field grow">
          <label>Basic (paise/mo)</label>
          <input className="input" value={f.basic_salary} onChange={(e) => set("basic_salary", e.target.value)} />
        </div>
        <div className="field grow">
          <label>Allowances (paise/mo)</label>
          <input className="input" value={f.allowances} onChange={(e) => set("allowances", e.target.value)} />
        </div>
      </div>
      <button
        className="btn btn-primary"
        disabled={busy || !f.code || !f.full_name}
        onClick={async () => {
          setBusy(true);
          try {
            await api.post("/hr/employees", {
              ...f,
              basic_salary: Number(f.basic_salary),
              allowances: Number(f.allowances),
            });
            toast("Employee added");
            onDone();
          } catch {
            toast("Failed (code may exist)", true);
            setBusy(false);
          }
        }}
      >
        Add employee
      </button>
    </Modal>
  );
}
