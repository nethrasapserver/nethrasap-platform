"use client";

import { createContext, useCallback, useContext, useState } from "react";

const ToastCtx = createContext<{ push: (t: string, err?: boolean) => void } | null>(null);
let seq = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; text: string; err?: boolean }[]>([]);
  const push = useCallback((text: string, err?: boolean) => {
    const id = seq++;
    setToasts((t) => [...t, { id, text, err }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      {/* Polite live region so screen readers announce inserted toasts;
          error toasts escalate to role="alert" (assertive). */}
      <div className="toast-host" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.err ? "err" : ""}`} role={t.err ? "alert" : undefined}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast within ToastProvider");
  return ctx.push;
}
