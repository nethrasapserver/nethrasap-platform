"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

interface NavItem {
  href: string;
  label: string;
  perm?: string; // required permission (omitted = any staff)
}
interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV: NavSection[] = [
  {
    title: "Overview",
    items: [{ href: "/", label: "Dashboard" }],
  },
  {
    title: "Commerce",
    items: [
      { href: "/orders", label: "Orders" },
      { href: "/verifications", label: "KYC queue", perm: "kyc:review" },
      { href: "/catalogue", label: "Catalogue", perm: "catalogue:write" },
      { href: "/inventory", label: "Inventory", perm: "inventory:write" },
    ],
  },
  {
    title: "Sales",
    items: [
      { href: "/enquiries", label: "Enquiries", perm: "enquiries:manage" },
      { href: "/chat", label: "Chat inbox", perm: "chat:manage" },
      { href: "/team", label: "Team", perm: "sales:read" },
    ],
  },
  {
    title: "People",
    items: [
      { href: "/hr/employees", label: "Employees", perm: "hr:manage" },
      { href: "/hr/leave", label: "Leave", perm: "hr:manage" },
      { href: "/hr/payroll", label: "Payroll", perm: "hr:manage" },
    ],
  },
  {
    title: "Admin",
    items: [{ href: "/audit", label: "Audit log", perm: "audit:read" }],
  },
];

export function Sidebar() {
  const { can } = useAuth();
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <div className="brand">
        Nethra<span>sap</span>
      </div>
      {NAV.map((sec) => {
        const items = sec.items.filter((i) => !i.perm || can(i.perm));
        if (items.length === 0) return null;
        return (
          <div key={sec.title}>
            <div className="side-sec">{sec.title}</div>
            {items.map((i) => {
              const active = i.href === "/" ? pathname === "/" : pathname.startsWith(i.href);
              return (
                <Link key={i.href} href={i.href} className={`side-link ${active ? "active" : ""}`}>
                  {i.label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </aside>
  );
}

export function Topbar() {
  const { user, logout } = useAuth();
  return (
    <div className="topbar">
      <div className="grow" />
      <span className="small muted">
        {user?.profile?.full_name} · <span className="pill pill-info">{user?.role}</span>
      </span>
      <button className="btn btn-ghost btn-sm" onClick={logout}>
        Sign out
      </button>
    </div>
  );
}
