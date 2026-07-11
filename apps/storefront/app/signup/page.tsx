"use client";

import type { TokenPair } from "@nethrasap/api-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { useToast } from "@/lib/toast";

const ROLES = [
  { value: "customer", label: "Individual / consumer" },
  { value: "clinician", label: "Clinician (institutional pricing)" },
  { value: "retailer", label: "Retailer / pharmacy (wholesale)" },
];

export default function SignupPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("customer");
  const [busy, setBusy] = useState(false);
  const { setSession } = useAuth();
  const { reload } = useCart();
  const toast = useToast();
  const router = useRouter();

  async function sendOtp() {
    setBusy(true);
    try {
      await api.post("/auth/otp/request", { phone, purpose: "signup" });
      toast("OTP sent — check your phone");
      setStep(2);
    } catch {
      toast("Could not send OTP", true);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    try {
      const res = await api.post<{ otp_token: string }>("/auth/otp/verify", {
        phone,
        purpose: "signup",
        code,
      });
      setOtpToken(res.otp_token);
      toast("Phone verified");
    } catch {
      toast("Invalid or expired code", true);
    } finally {
      setBusy(false);
    }
  }

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const t = await api.post<TokenPair>("/auth/signup", {
        role,
        otp_token: otpToken,
        password,
        name,
      });
      await setSession(t);
      await reload();
      toast("Welcome to Nethrasap");
      router.push(role === "customer" ? "/account" : "/account?kyc=1");
    } catch {
      toast("Could not complete signup", true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="card pad auth-card">
        <h2>Create account</h2>
        <p className="muted small" style={{ marginTop: -6, marginBottom: 18 }}>
          Phone verification keeps the platform audited.
        </p>

        {step === 1 && (
          <>
            <div className="field">
              <label>Phone number</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98450 12345" required />
            </div>
            <button className="btn btn-primary btn-block" disabled={busy || !phone} onClick={sendOtp}>
              Send OTP
            </button>
          </>
        )}

        {step === 2 && !otpToken && (
          <>
            <div className="field">
              <label>6-digit code sent to {phone}</label>
              <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" maxLength={6} required />
            </div>
            <button className="btn btn-primary btn-block" disabled={busy || code.length !== 6} onClick={verify}>
              Verify phone
            </button>
          </>
        )}

        {step === 2 && otpToken && (
          <form onSubmit={finish}>
            <div className="field">
              <label>Account type</label>
              <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Full name / business name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label>Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
            </div>
            {role !== "customer" && (
              <p className="small muted" style={{ marginBottom: 12 }}>
                You&apos;ll be asked to upload KYC documents after signup to unlock{" "}
                {role === "retailer" ? "wholesale" : "institutional"} pricing.
              </p>
            )}
            <button className="btn btn-primary btn-block" disabled={busy}>
              Create account
            </button>
          </form>
        )}

        <p className="small muted" style={{ marginTop: 16, textAlign: "center" }}>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
