"use client";

import { createContext, useCallback, useContext, useState } from "react";

interface Toast {
  id: number;
  text: string;
  err?: boolean;
}
const ToastContext = createContext<{ push: (text: string, err?: boolean) => void } | null>(null);

let seq = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, err?: boolean) => {
    const id = seq++;
    setToasts((t) => [...t, { id, text, err }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      {/* Polite live region so screen readers announce toasts as they arrive;
          error toasts escalate to role="alert" (assertive). */}
      <div className="toast-host" role="status" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.err ? "err" : ""}`} {...(t.err ? { role: "alert" } : {})}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast within ToastProvider");
  return ctx.push;
}
