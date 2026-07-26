"use client";

import { useEffect, useRef, useState } from "react";

/* Indian tricolour — inline SVG so it renders identically on every OS
   (emoji flags are missing/blank on Windows). Saffron / white+chakra / green. */
export function IndiaFlag({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="14" viewBox="0 0 30 20" aria-hidden="true"
      style={{ display: "block", borderRadius: 2, boxShadow: "0 0 0 1px rgba(0,0,0,.08)" }}>
      <rect width="30" height="20" fill="#fff" />
      <rect width="30" height="6.67" fill="#FF9933" />
      <rect y="13.33" width="30" height="6.67" fill="#138808" />
      <circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" strokeWidth="0.7" />
      <circle cx="15" cy="10" r="0.5" fill="#000080" />
    </svg>
  );
}

/* ---------- Phone ----------
   India-first platform, so +91 is a fixed affix rather than something to type.
   The backend normalises anyway (app/phone.py) — this just removes a decision
   from the user and stops "+91 98450..." double-prefix mistakes.
   `compact` matches the 44px height of the standard .input used in forms. */
export function PhoneField({
  value,
  onChange,
  id = "phone",
  label = "Phone number",
  disabled,
  error,
  autoFocus,
  required,
  compact,
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  label?: string;
  disabled?: boolean;
  error?: string | null;
  autoFocus?: boolean;
  required?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="field">
      {label ? <label htmlFor={id}>{label}</label> : null}
      <div
        className={`phone-input ${compact ? "phone-input--sm" : ""} ${error ? "is-error" : ""} ${disabled ? "is-disabled" : ""}`}
      >
        <span className="prefix">
          <IndiaFlag />
          +91
        </span>
        <input
          id={id}
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="98450 12345"
          maxLength={10}
          required={required}
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
        />
      </div>
      {error && (
        <span className="field-error" id={`${id}-err`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/* ---------- OTP ----------
   Six cells rather than one box: it matches how codes arrive on a phone,
   auto-advances, supports paste, and makes a wrong digit obvious. */
export function OtpInput({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  function setDigit(i: number, digit: string) {
    const next = (value.padEnd(6, " ").split("") as string[]);
    next[i] = digit || " ";
    onChange(next.join("").replace(/\s/g, " ").trimEnd().replace(/\s/g, ""));
    if (digit && i < 5) refs.current[i + 1]?.focus();
  }

  return (
    <div className="field">
      <label htmlFor="otp-0">6-digit code</label>
      <div className="otp-row" onPaste={(e) => {
        const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        if (!digits) return;
        e.preventDefault();
        onChange(digits);
        refs.current[Math.min(digits.length, 5)]?.focus();
      }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <input
            key={i}
            id={`otp-${i}`}
            ref={(el) => { refs.current[i] = el; }}
            className={`otp-cell ${error ? "is-error" : ""}`}
            inputMode="numeric"
            maxLength={1}
            autoComplete={i === 0 ? "one-time-code" : "off"}
            aria-label={`Digit ${i + 1}`}
            value={value[i] ?? ""}
            onChange={(e) => setDigit(i, e.target.value.replace(/\D/g, "").slice(-1))}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1]?.focus();
              if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
              if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
            }}
          />
        ))}
      </div>
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/* ---------- Password ---------- */
export function PasswordField({
  value,
  onChange,
  id = "password",
  label = "Password",
  autoComplete = "current-password",
  hint,
  error,
  minLength,
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  label?: string;
  autoComplete?: string;
  hint?: string;
  error?: string | null;
  minLength?: number;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`pw-input ${error ? "is-error" : ""}`}>
        <input
          id={id}
          type={shown ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          minLength={minLength}
          aria-invalid={!!error}
          required
        />
        <button type="button" onClick={() => setShown((s) => !s)} aria-label={shown ? "Hide password" : "Show password"}>
          {shown ? (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.4 5.2A9.6 9.6 0 0112 5c5 0 9 4.5 9 7a11 11 0 01-2.4 3.5M6.2 6.5A11.6 11.6 0 003 12c0 2.5 4 7 9 7 1.2 0 2.3-.2 3.3-.7" /></svg>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M3 12s3.6-7 9-7 9 7 9 7-3.6 7-9 7-9-7-9-7z" /><circle cx="12" cy="12" r="2.6" /></svg>
          )}
        </button>
      </div>
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error" role="alert">{error}</span>}
    </div>
  );
}

/** Countdown for OTP resend — the backend enforces a 45s cooldown. */
export function useResendTimer(seconds = 45) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return { left, start: () => setLeft(seconds) };
}
