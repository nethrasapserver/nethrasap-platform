"use client";

import { PortalChrome } from "@/components/Shell";
import { useAuth } from "@/lib/auth";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--brand-900)", color: "var(--cream)" }}>
        Loading…
      </div>
    );
  }

  return <PortalChrome>{children}</PortalChrome>;
}
