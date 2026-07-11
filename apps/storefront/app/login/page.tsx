"use client";

import type { TokenPair } from "@nethrasap/api-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { useToast } from "@/lib/toast";

type Mode = "password" | "otp";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("password");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const { setSession } = useAuth();
  const { reload } = useCart();
  const toast = useToast();
  const router = useRouter();

  async function done(t: TokenPair) {
    await setSession(t);
    await reload();
    toast("Signed in");
    router.push("/account");
  }

  async function loginPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const t = await api.post<TokenPair>("/auth/login", { phone, password });
      await done(t);
    } catch {
      toast("Invalid phone or password", true);
    } finally {
      setBusy(false);
    }
  }

  async function requestOtp() {
    setBusy(true);
    try {
      await api.post("/auth/otp/request", { phone, purpose: "login" });
      setOtpSent(true);
      toast("OTP sent — check your phone");
    } catch {
      toast("Could not send OTP", true);
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const t = await api.post<TokenPair>("/auth/otp/verify", {
        phone,
        purpose: "login",
        code,
      });
      await done(t);
    } catch {
      toast("Invalid or expired code", true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="card pad auth-card">
        <h2>Sign in</h2>
        <p className="muted small" style={{ marginTop: -6, marginBottom: 18 }}>
          Use your registered phone number.
        </p>

        <div className="row" style={{ gap: 6, marginBottom: 18 }}>
          <button
            className={`btn btn-sm ${mode === "password" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setMode("password")}
          >
            Password
          </button>
          <button
            className={`btn btn-sm ${mode === "otp" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setMode("otp")}
          >
            OTP
          </button>
        </div>

        {mode === "password" ? (
          <form onSubmit={loginPassword}>
            <div className="field">
              <label>Phone number</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98450 12345" required />
            </div>
            <div className="field">
              <label>Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button className="btn btn-primary btn-block" disabled={busy}>
              Sign in
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp}>
            <div className="field">
              <label>Phone number</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98450 12345" required disabled={otpSent} />
            </div>
            {otpSent && (
              <div className="field">
                <label>6-digit code</label>
                <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" maxLength={6} required />
              </div>
            )}
            {otpSent ? (
              <button className="btn btn-primary btn-block" disabled={busy}>
                Verify &amp; sign in
              </button>
            ) : (
              <button type="button" className="btn btn-primary btn-block" disabled={busy || !phone} onClick={requestOtp}>
                Send OTP
              </button>
            )}
          </form>
        )}

        <p className="small muted" style={{ marginTop: 16, textAlign: "center" }}>
          New here? <Link href="/signup">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
