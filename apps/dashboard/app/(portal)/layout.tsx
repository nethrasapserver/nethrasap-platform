"use client";

import { useAuth } from "@/lib/auth";
import { Sidebar, Topbar } from "@/components/Shell";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return <div className="auth-wrap" style={{ color: "#cdd2c2" }}>Loading…</div>;
  }

  return (
    <div className="layout">
      <Sidebar />
      <div className="main">
        <Topbar />
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
