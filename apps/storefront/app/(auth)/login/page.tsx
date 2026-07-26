"use client";

import type { TokenPair } from "@nethrasap/api-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { OtpInput, PasswordField, PhoneField, useResendTimer } from "@nethrasap/ui/fields";
import { GoogleButton } from "@/components/GoogleButton";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { useToast } from "@/lib/toast";

type Mode = "password" | "otp";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("password");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  // Errors live under the field that caused them, not only in a toast that
  // vanishes before the user has finished reading it.
  const [err, setErr] = useState<{ phone?: string; password?: string; code?: string }>({});

  const { user, setSession } = useAuth();
  const { reload } = useCart();
  const toast = useToast();
  const router = useRouter();
  const resend = useResendTimer();

  const phoneValid = phone.length === 10;

  // Drive the redirect off auth state rather than off the tail of the submit
  // handler: it can't race the session settling, and it also bounces an
  // already-signed-in visitor straight out of /login.
  useEffect(() => {
    if (user) {
      // Honour ?next=/path (same-origin only) so gated pages can round-trip.
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next && next.startsWith("/") ? next : "/account");
    }
  }, [user, router]);

  async function done(t: TokenPair) {
    await setSession(t);
    await reload();
    toast("Signed in");
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setErr({});
    setBusy(true);
    try {
      await done(await api.post<TokenPair>("/auth/login", { phone, password }));
    } catch {
      setErr({ password: "That phone number and password don't match." });
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
    setErr({});
    if (!phoneValid) return setErr({ phone: "Enter your 10-digit mobile number." });
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
      await done(await api.post<TokenPair>("/auth/otp/verify", { phone, purpose: "login", code }));
    } catch {
      setErr({ code: "That code is wrong or has expired." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card-v2">
      <h1>Welcome back</h1>
      <p className="auth-sub">Sign in with your registered mobile number.</p>

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

      {mode === "password" ? (
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
          <p className="auth-hint">We&apos;ll text you a 6-digit code. No password needed.</p>
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
          <button
            type="button"
            className="linkish center"
            disabled={busy || resend.left > 0}
            onClick={sendCode}
          >
            {resend.left > 0 ? `Resend code in ${resend.left}s` : "Resend code"}
          </button>
        </form>
      )}

      <div className="auth-or"><span>or</span></div>
      <GoogleButton label="Sign in with Google" />

      <p className="auth-alt">
        New to Nethrasap? <Link href="/signup">Create an account</Link>
      </p>
    </div>
  );
}
