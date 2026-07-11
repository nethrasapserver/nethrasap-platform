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
      <div className="toast-host">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.err ? "err" : ""}`}>
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
