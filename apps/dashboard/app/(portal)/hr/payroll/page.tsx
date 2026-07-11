"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { inrExact } from "@/lib/format";
import { useToast } from "@/lib/toast";

interface RunResult {
  run_id: string;
  period: string;
  total_net_paise: number;
  payslips: number;
  status: string;
}

export default function PayrollPage() {
  const now = new Date();
  const [period, setPeriod] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
  );
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const toast = useToast();

  async function run() {
    setBusy(true);
    try {
      const r = await api.post<RunResult>("/hr/payroll/runs", { period });
      setResult(r);
      toast(`Payroll processed — ${r.payslips} payslips`);
    } catch {
      toast("Run failed (already processed?)", true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Payroll</h1>
      </div>
      <div className="card pad" style={{ maxWidth: 480 }}>
        <div className="field">
          <label>Pay period (month)</label>
          <input className="input" type="date" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={run} disabled={busy}>
          {busy ? "Processing…" : "Run payroll"}
        </button>
        <p className="muted small" style={{ marginTop: 12 }}>
          Computes net pay for every active employee (basic + allowances − 12% PF) and generates
          payslip PDFs. Idempotent per month.
        </p>

        {result && (
          <div className="card pad" style={{ marginTop: 16, background: "var(--brand-tint)" }}>
            <div className="row spread">
              <span className="muted">Period</span>
              <strong>{result.period}</strong>
            </div>
            <div className="row spread" style={{ marginTop: 6 }}>
              <span className="muted">Payslips</span>
              <strong>{result.payslips}</strong>
            </div>
            <div className="row spread" style={{ marginTop: 6 }}>
              <span className="muted">Total net</span>
              <strong>{inrExact(result.total_net_paise)}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
