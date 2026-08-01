"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AccessDenied } from "./_lib";

const TABS = [
  { href: "/platform", label: "Overview" },
  { href: "/platform/audit", label: "Audit log" },
  { href: "/platform/flags", label: "Feature flags" },
  { href: "/platform/integrations", label: "Integrations" },
];

/**
 * Platform-Ops section shell: title + sub-page tabs. Client-gated on the
 * platform:admin permission — the same permission the nav entry gates on and
 * the backend enforces. Non-admins who deep-link here get an access-denied
 * panel, not a broken console; each page also defends against a 403 (H-13).
 */
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { can, loading } = useAuth();

  const allowed = can("platform:admin");

  return (
    <div>
      <div className="page-head">
        <h1>Platform Ops</h1>
      </div>
      <p className="muted small" style={{ marginTop: -6, marginBottom: 14 }}>
        Super-admin console. Every change made here is written to the audit log.
      </p>

      {loading ? null : !allowed ? (
        <AccessDenied />
      ) : (
        <>
          <nav className="subtabs" aria-label="Platform Ops sections">
            {TABS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={`subtab ${pathname === t.href ? "on" : ""}`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          {children}
        </>
      )}
    </div>
  );
}
