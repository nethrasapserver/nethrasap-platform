"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

function I({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const IC: Record<string, string> = {
  dash: "M3 12h7V3H3zM14 21h7v-9h-7zM14 3v5h7V3zM3 16v5h7v-5z",
  orders: "M6 6h15l-1.5 8H8L6 3H3M9 20a1.6 1.6 0 100-3.2A1.6 1.6 0 009 20zm9 0a1.6 1.6 0 100-3.2A1.6 1.6 0 0018 20z",
  kyc: "M9 12l2 2 4-5M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7z",
  catalogue: "M4 7h16M6 7v12a2 2 0 002 2h8a2 2 0 002-2V7M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2",
  categories: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  inventory: "M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
  enquiries: "M21 11.5a8.4 8.4 0 01-9 8.4 8.6 8.6 0 01-3.9-.9L3 21l2-4.9a8.4 8.4 0 1116-4.6z",
  chat: "M8 10h8M8 14h5M21 12a9 9 0 11-4-7.5L21 3z",
  team: "M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9.5 11a4 4 0 100-8 4 4 0 000 8zM21 21v-2a4 4 0 00-3-3.9M15 3.1a4 4 0 010 7.8",
  people: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1.5-4 5-6 8-6s6.5 2 8 6",
  leave: "M8 2v4M16 2v4M3 9h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z",
  payroll: "M3 17l5-6 4 3 5-7 4 5M3 21h18",
  audit: "M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9zM14 3v6h6M9 13h6M9 17h4",
};

interface NavItem { href: string; label: string; icon: string; perm?: string; }
interface NavSection { title: string; items: NavItem[]; }

const NAV: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: "dash" },
      { href: "/analytics", label: "Analytics", icon: "payroll", perm: "analytics:read" },
    ],
  },
  {
    title: "Commerce",
    items: [
      { href: "/orders", label: "Orders", icon: "orders" },
      { href: "/products", label: "Products", icon: "catalogue", perm: "catalogue:write" },
      { href: "/categories", label: "Categories", icon: "categories", perm: "catalogue:write" },
      { href: "/inventory", label: "Inventory", icon: "inventory", perm: "inventory:write" },
    ],
  },
  {
    title: "Sales",
    items: [
      { href: "/enquiries", label: "Enquiries", icon: "enquiries", perm: "enquiries:manage" },
      { href: "/verifications", label: "Verifications", icon: "kyc", perm: "kyc:review" },
    ],
  },
  {
    title: "People",
    items: [
      { href: "/hr/employees", label: "Employees", icon: "people", perm: "hr:manage" },
      { href: "/hr/leave", label: "Leave", icon: "leave", perm: "hr:manage" },
    ],
  },
];

/** Full portal chrome: brand-900 sidebar (mobile drawer) + sticky topbar. */
export function PortalChrome({ children }: { children: React.ReactNode }) {
  const { user, can, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer on navigation.
  useEffect(() => setOpen(false), [pathname]);

  const crumb =
    NAV.flatMap((s) => s.items).find((i) =>
      i.href === "/" ? pathname === "/" : pathname.startsWith(i.href),
    )?.label ?? "Dashboard";

  const initials =
    user?.profile?.full_name
      ?.split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ?? "•";

  return (
    <div className="portal">
      {open && <div className="pscrim" onClick={() => setOpen(false)} />}
      <aside className={`psidebar ${open ? "open" : ""}`}>
        <div className="plogo">
          Nethra<span>sap</span> Ops
        </div>
        {NAV.map((sec) => {
          const items = sec.items.filter((i) => !i.perm || can(i.perm));
          if (items.length === 0) return null;
          return (
            <div key={sec.title}>
              <div className="pside-label">{sec.title}</div>
              {items.map((i) => {
                const active = i.href === "/" ? pathname === "/" : pathname.startsWith(i.href);
                return (
                  <Link
                    key={i.href}
                    href={i.href}
                    className={`pside-link ${active ? "on" : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    <I d={IC[i.icon]} />
                    {i.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
        <div className="pside-foot">
          <span className="avatar">{initials}</span>
          <span className="who">
            <b>{user?.profile?.full_name}</b>
            <span>{user?.role}</span>
          </span>
        </div>
      </aside>

      <div className="pmain">
        <div className="ptop">
          <button className="icon-btn pside-toggle" onClick={() => setOpen(true)} aria-label="Open menu">
            <I d="M4 7h16M4 12h16M4 17h16" size={18} />
          </button>
          <span className="crumb">{crumb}</span>
          <div className="grow" />
          <span className="pill pill-info">{user?.role}</span>
          <button className="btn btn-danger-solid btn-sm" onClick={logout}>
            Sign out
          </button>
        </div>
        <div className="pbody">{children}</div>
      </div>
    </div>
  );
}
