"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/analytics", label: "Overview" },
  { href: "/analytics/sales", label: "Sales team" },
  { href: "/analytics/funnel", label: "RFQ funnel" },
  { href: "/analytics/catalogue", label: "Catalogue & stock" },
];

/** Analytics section shell: title + sub-page tabs above each page's bento. */
export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div>
      <div className="page-head">
        <h1>Analytics</h1>
      </div>
      <nav className="subtabs" aria-label="Analytics sections">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={`subtab ${pathname === t.href ? "on" : ""}`}>
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
