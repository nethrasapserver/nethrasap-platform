"use client";

import type { TokenPair } from "@nethrasap/api-client";
import { OtpInput, PasswordField, PhoneField, useResendTimer } from "@nethrasap/ui/fields";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";

type Mode = "password" | "otp";

// OTP UI is hidden until SMS/DLT goes live (the /auth/otp/* endpoints 503
// while the backend's OTP_ENABLED is off). Staff always have passwords.
const OTP_ENABLED = process.env.NEXT_PUBLIC_OTP_ENABLED !== "false";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("password");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ phone?: string; password?: string; code?: string }>({});

  const { login } = useAuth();
  const toast = useToast();
  const resend = useResendTimer();

  const phoneValid = phone.length === 10;

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setErr({});
    setBusy(true);
    try {
      await login(await api.post<TokenPair>("/auth/login", { phone, password }));
      toast("Signed in");
    } catch {
      setErr({ password: "That phone number and password don't match." });
      setBusy(false);
    }
  }

  async function sendCode() {
    setErr({});
    if (!phoneValid) return setErr({ phone: "Enter the 10-digit number on your staff account." });
    setBusy(true);
    try {
      await api.post("/auth/otp/request", { phone, purpose: "login" });
      setSent(true);
      resend.start();
      toast("Code sent to your phone");
    } catch {
      setErr({ phone: "We couldn't send a code to that number." });
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setErr({});
    setBusy(true);
    try {
      await login(await api.post<TokenPair>("/auth/otp/verify", { phone, purpose: "login", code }));
      toast("Signed in");
    } catch {
      setErr({ code: "That code is wrong or has expired." });
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg" aria-hidden="true">
        <span className="orb orb-1" />
        <span className="orb orb-2" />
        <span className="cap cap-1" />
        <span className="cap cap-2" />
        <span className="cap cap-3" />
      </div>

      <div className="auth-col">
        <span className="logo auth-logo">
          Nethra<span>sap</span> Ops
        </span>

        <div className="auth-card-v2">
          <h1>Staff sign-in</h1>
          <p className="auth-sub">
            The operations console for orders, verifications, inventory and HR.
          </p>

          {OTP_ENABLED && (
            <div className="seg" role="tablist" aria-label="Sign-in method">
              <button
                role="tab"
                aria-selected={mode === "password"}
                className={mode === "password" ? "on" : ""}
                onClick={() => { setMode("password"); setErr({}); }}
              >
                Password
              </button>
              <button
                role="tab"
                aria-selected={mode === "otp"}
                className={mode === "otp" ? "on" : ""}
                onClick={() => { setMode("otp"); setErr({}); }}
              >
                One-time code
              </button>
            </div>
          )}

          {mode === "password" || !OTP_ENABLED ? (
            <form onSubmit={signInWithPassword} noValidate>
              <PhoneField value={phone} onChange={setPhone} error={err.phone} autoFocus />
              <PasswordField value={password} onChange={setPassword} error={err.password} />
              <button className="btn btn-primary btn-block btn-lg" disabled={busy || !phoneValid || !password}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>
          ) : !sent ? (
            <form onSubmit={(e) => { e.preventDefault(); sendCode(); }} noValidate>
              <PhoneField value={phone} onChange={setPhone} error={err.phone} autoFocus />
              <button className="btn btn-primary btn-block btn-lg" disabled={busy || !phoneValid}>
                {busy ? "Sending…" : "Send code"}
              </button>
              <p className="auth-hint">We&apos;ll text a 6-digit code to your registered number.</p>
            </form>
          ) : (
            <form onSubmit={verify} noValidate>
              <p className="auth-sent">
                Code sent to <b>+91 {phone}</b>
                <button type="button" className="linkish" onClick={() => { setSent(false); setCode(""); setErr({}); }}>
                  Change
                </button>
              </p>
              <OtpInput value={code} onChange={setCode} error={err.code} />
              <button className="btn btn-primary btn-block btn-lg" disabled={busy || code.length !== 6}>
                {busy ? "Verifying…" : "Verify & sign in"}
              </button>
              <button type="button" className="linkish center" disabled={busy || resend.left > 0} onClick={sendCode}>
                {resend.left > 0 ? `Resend code in ${resend.left}s` : "Resend code"}
              </button>
            </form>
          )}

          {/* No Google here: staff accounts are provisioned internally and are
              permission-gated — an external identity provider has no role. */}
          <p className="auth-alt">Staff access only. Ask an admin if you need an account.</p>
        </div>

        <p className="auth-trust">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 12l2 2 4-5M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7z" />
          </svg>
          Every action in this console is written to the audit log
        </p>
      </div>
    </div>
  );
}
