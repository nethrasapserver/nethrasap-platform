"use client";

import type { TokenPair } from "@nethrasap/api-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { OtpInput, PasswordField, PhoneField, useResendTimer } from "@nethrasap/ui/fields";
import { GoogleButton } from "@/components/GoogleButton";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { useToast } from "@/lib/toast";

const ROLES = [
  { value: "customer", label: "For myself", hint: "Personal and family orders" },
  { value: "clinician", label: "Clinic or hospital", hint: "Institutional pricing" },
  { value: "retailer", label: "Pharmacy", hint: "Wholesale pricing" },
];

export default function SignupPage() {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("customer");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ phone?: string; code?: string; password?: string }>({});

  const { user, setSession } = useAuth();
  const { reload } = useCart();
  const toast = useToast();
  const router = useRouter();
  const resend = useResendTimer();
  // Set once the signup form is submitted, so the "already signed in" bounce
  // below doesn't steal the KYC-aware destination from finish().
  const submitting = useRef(false);

  const phoneValid = phone.length === 10;

  useEffect(() => {
    if (user && !submitting.current) router.replace("/account");
  }, [user, router]);

  async function sendCode() {
    setErr({});
    if (!phoneValid) return setErr({ phone: "Enter your 10-digit mobile number." });
    setBusy(true);
    try {
      await api.post("/auth/otp/request", { phone, purpose: "signup" });
      setStage(1);
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
      const res = await api.post<{ otp_token: string }>("/auth/otp/verify", {
        phone,
        purpose: "signup",
        code,
      });
      setOtpToken(res.otp_token);
      setStage(2);
    } catch {
      setErr({ code: "That code is wrong or has expired." });
    } finally {
      setBusy(false);
    }
  }

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    setErr({});
    setBusy(true);
    submitting.current = true;
    try {
      const t = await api.post<TokenPair>("/auth/signup", { role, otp_token: otpToken, password, name });
      await setSession(t);
      await reload();
      toast("Welcome to Nethrasap");
      router.push(role === "customer" ? "/account" : "/account?kyc=1");
    } catch {
      submitting.current = false;
      setErr({ password: "Could not create the account. Try a different password." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card-v2">
      <h1>{stage === 2 ? "Almost there" : "Create your account"}</h1>
      <p className="auth-sub">
        {stage === 0 && "We verify every buyer by phone — it keeps the supply chain audited."}
        {stage === 1 && "Enter the code we just sent you."}
        {stage === 2 && "Tell us who you're buying for."}
      </p>

      {/* A quiet progress rail — three dots, no numbered chrome. */}
      <div className="auth-rail" aria-label={`Step ${stage + 1} of 3`}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={i === stage ? "on" : i < stage ? "done" : ""} />
        ))}
      </div>

      {stage === 0 && (
        <form onSubmit={(e) => { e.preventDefault(); sendCode(); }} noValidate>
          <PhoneField value={phone} onChange={setPhone} error={err.phone} autoFocus />
          <button className="btn btn-primary btn-block btn-lg" disabled={busy || !phoneValid}>
            {busy ? "Sending…" : "Send code"}
          </button>
        </form>
      )}

      {stage === 1 && (
        <form onSubmit={verify} noValidate>
          <p className="auth-sent">
            Code sent to <b>+91 {phone}</b>
            <button type="button" className="linkish" onClick={() => { setStage(0); setCode(""); setErr({}); }}>
              Change
            </button>
          </p>
          <OtpInput value={code} onChange={setCode} error={err.code} />
          <button className="btn btn-primary btn-block btn-lg" disabled={busy || code.length !== 6}>
            {busy ? "Verifying…" : "Verify phone"}
          </button>
          <button type="button" className="linkish center" disabled={busy || resend.left > 0} onClick={sendCode}>
            {resend.left > 0 ? `Resend code in ${resend.left}s` : "Resend code"}
          </button>
        </form>
      )}

      {stage === 2 && (
        <form onSubmit={finish} noValidate>
          <div className="field">
            <label>Who are you buying for?</label>
            <div className="role-picker">
              {ROLES.map((r) => (
                <label key={r.value} className={`role-opt ${role === r.value ? "on" : ""}`}>
                  <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} />
                  <span>
                    <b>{r.label}</b>
                    <span>{r.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="su-name">{role === "customer" ? "Your name" : "Business name"}</label>
            <input id="su-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </div>
          <PasswordField
            value={password}
            onChange={setPassword}
            id="su-pw"
            autoComplete="new-password"
            minLength={8}
            hint="At least 8 characters."
            error={err.password}
          />
          {role !== "customer" && (
            <p className="auth-note">
              You&apos;ll upload {role === "retailer" ? "your drug licence (20B/21B) and GSTIN" : "your council registration"} next
              to unlock {role === "retailer" ? "wholesale" : "institutional"} pricing. You can order at standard pricing meanwhile.
            </p>
          )}
          <button className="btn btn-primary btn-block btn-lg" disabled={busy || !name || password.length < 8}>
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>
      )}

      {stage === 0 && (
        <>
          <div className="auth-or"><span>or</span></div>
          <GoogleButton label="Sign up with Google" />
        </>
      )}

      <p className="auth-alt">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </div>
  );
}
