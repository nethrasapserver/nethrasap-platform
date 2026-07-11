"use client";

import type { TokenPair } from "@nethrasap/api-client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const toast = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const t = await api.post<TokenPair>("/auth/login", { phone, password });
      await login(t);
      toast("Signed in");
    } catch {
      toast("Invalid phone or password", true);
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <div style={{ fontWeight: 750, fontSize: "1.3rem", marginBottom: 4 }}>
          Nethrasap <span style={{ color: "var(--brand)" }}>Ops</span>
        </div>
        <p className="muted small" style={{ marginTop: 0, marginBottom: 20 }}>
          Staff sign-in
        </p>
        <div className="field">
          <label>Phone number</label>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98000 00004" required />
        </div>
        <div className="field">
          <label>Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={busy}>
          Sign in
        </button>
        <p className="muted small" style={{ marginTop: 16, marginBottom: 0 }}>
          Demo: <code>9800000006</code> (admin) / <code>Demo123!</code>
        </p>
      </form>
    </div>
  );
}
