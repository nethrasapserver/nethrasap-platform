"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { inr } from "@/lib/format";
import { useSaved } from "@/lib/saved";

/* ---------- Icons (inline, stroke=currentColor — the design-system factory style) ---------- */
function I({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const IC = {
  home: "M3 11l9-8 9 8v9a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2z",
  search: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4-4",
  heart: "M12 21s-7.5-4.6-9.9-9A5.6 5.6 0 0112 6.3 5.6 5.6 0 0121.9 12c-2.4 4.4-9.9 9-9.9 9z",
  cart: "M6 6h15l-1.5 8H8L6 3H3M9 20a1.6 1.6 0 100-3.2A1.6 1.6 0 009 20zm9 0a1.6 1.6 0 100-3.2A1.6 1.6 0 0018 20z",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1.5-4 5-6 8-6s6.5 2 8 6",
  chevron: "M6 9l6 6 6-6",
  box: "M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
  compare: "M8 3L4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4",
  pin: "M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z M12 10a1.6 1.6 0 100-3.2 1.6 1.6 0 000 3.2z",
  chat: "M21 11.5a8.4 8.4 0 01-9 8.4 8.6 8.6 0 01-3.9-.9L3 21l2-4.9a8.4 8.4 0 1116-4.6z",
  logout: "M15 17l5-5-5-5M20 12H9M12 3H6a2 2 0 00-2 2v14a2 2 0 002 2h6",
};

function initialsOf(name: string | null | undefined, fallback: string) {
  if (!name) return fallback;
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const TRENDING = ["Amoxicillin", "Insulin", "BP monitor", "Thermometer", "Vitamin D3", "Surgical gloves"];

/* ---------- Announcement bar ---------- */
export function Announce() {
  return (
    <div className="announce">
      <b>Pan-India delivery</b> across serviceable pincodes · GDP-compliant cold chain · CDSCO-verified sourcing
    </div>
  );
}

/* ---------- Staff-on-storefront banner ----------
   Staff may shop here deliberately (ordering on a customer's behalf — the
   pricing service grants them retailer-tier rates). The banner removes the
   ambiguity of landing on a customer account page and offers the way out. */
const STAFF_ROLES = new Set(["sales", "manager", "admin"]);
const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3001";

export function StaffBanner() {
  const { user } = useAuth();
  if (!user || !STAFF_ROLES.has(user.role)) return null;
  return (
    <div className="staff-bar" role="status">
      <span>
        Signed in as <b>{user.role}</b> — you&apos;re browsing the customer storefront at
        retailer-tier pricing.
      </span>
      <a className="staff-bar-go" href={DASHBOARD_URL}>
        Open Ops Dashboard →
      </a>
    </div>
  );
}

/* ---------- Search overlay ---------- */
function SearchOverlay({ onClose, trending, placeholder = "Search medicines, devices…" }: { onClose: () => void; trending?: string[]; placeholder?: string }) {
  const terms = trending && trending.length ? trending : TRENDING;
  const router = useRouter();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function go(term: string) {
    onClose();
    router.push(`/products?q=${encodeURIComponent(term)}`);
  }

  return (
    <div className="search-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Search products">
      <div className="search-panel" onClick={(e) => e.stopPropagation()}>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) go(q.trim());
          }}
        >
          <input
            ref={inputRef}
            className="input grow"
            placeholder={placeholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search"
          />
          <button type="submit" className="btn btn-primary" disabled={!q.trim()}>
            Search
          </button>
        </form>
        <div className="eyebrow" style={{ marginTop: 16 }}>Trending</div>
        <div className="search-chips">
          {terms.map((t) => (
            <button key={t} type="button" className="search-chip" onClick={() => go(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Profile menu ----------
   Everything account-shaped lives behind one avatar: destinations first,
   sign-out last and visually separated so it is never a mis-click. */
function UserMenu() {
  const { user, logout } = useAuth();
  const { wishlist, compare } = useSaved();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) {
    return (
      <Link href="/login" className="btn btn-primary btn-sm">
        Sign in
      </Link>
    );
  }

  const name = user.profile?.full_name ?? "Account";
  const links = [
    { href: "/account", label: "Account & orders", icon: IC.box },
    { href: "/enquiries", label: "Quote requests", icon: IC.chat },
    { href: "/wishlist", label: "Saved items", icon: IC.heart, count: wishlist?.count },
    { href: "/compare", label: "Compare", icon: IC.compare, count: compare?.count },
    { href: "/track", label: "Track an order", icon: IC.pin },
  ];

  return (
    <div className="usermenu" ref={wrap}>
      <button
        type="button"
        className="usermenu-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="avatar-sm">{initialsOf(user.profile?.full_name, "•")}</span>
        <span className="usermenu-name hide-md">{name.split(" ")[0]}</span>
        <I d={IC.chevron} size={14} />
      </button>

      {open && (
        <div className="usermenu-pop" role="menu">
          <div className="usermenu-head">
            <span className="avatar-sm">{initialsOf(user.profile?.full_name, "•")}</span>
            <span style={{ minWidth: 0 }}>
              <b>{name}</b>
              <span className="eyebrow">{user.role}</span>
            </span>
          </div>

          {links.map((l) => (
            <Link key={l.href} href={l.href} className="usermenu-item" role="menuitem" onClick={() => setOpen(false)}>
              <I d={l.icon} size={16} />
              {l.label}
              {l.count ? <span className="usermenu-count">{l.count}</span> : null}
            </Link>
          ))}

          <button
            type="button"
            className="usermenu-item is-danger"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              logout();
            }}
          >
            <I d={IC.logout} size={16} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Header ---------- */
type NavLink = { href: string; label: string };
const DEFAULT_HEADER_NAV: NavLink[] = [
  { href: "/products", label: "Products" },
  { href: "/categories", label: "Categories" },
  { href: "/track", label: "Track" },
  { href: "/about", label: "About" },
];

/* `nav` / `trending` are fed by <SiteHeader> from the global CMS page; both fall
   back to the built-in defaults so the header renders even with no CMS data. */
export function Header({
  nav,
  trending,
  searchPlaceholder = "Search medicines, devices…",
}: {
  nav?: NavLink[];
  trending?: string[];
  searchPlaceholder?: string;
}) {
  const headerNav = nav && nav.length ? nav : DEFAULT_HEADER_NAV;
  const { user } = useAuth();
  const { count } = useCart();
  const { wishlist } = useSaved();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const savedCount = wishlist?.count ?? 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="header">
      <div className="container">
        <Link href="/" className="logo">
          Nethra<span>sap</span>
        </Link>

        <button type="button" className="search-pill hide-sm" onClick={() => setSearchOpen(true)} aria-label="Search products">
          <I d={IC.search} size={16} />
          <span className="search-pill-text">{searchPlaceholder}</span>
          <kbd>⌘K</kbd>
        </button>

        <nav className="nav-links" aria-label="Browse">
          {headerNav.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href || pathname.startsWith(`${l.href}/`) ? "page" : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <button type="button" className="icon-btn only-sm" onClick={() => setSearchOpen(true)} aria-label="Search products">
            <I d={IC.search} size={18} />
          </button>

          {user && (
            <Link href="/wishlist" className="icon-btn has-badge" aria-label={`Saved items, ${savedCount}`}>
              <I d={IC.heart} size={18} />
              {savedCount > 0 && <span className="badge">{savedCount}</span>}
            </Link>
          )}

          <Link href="/cart" className="icon-btn has-badge" aria-label={`Cart, ${count} items`}>
            <I d={IC.cart} size={18} />
            {count > 0 && <span className="badge">{count}</span>}
          </Link>

          <UserMenu />
        </div>
      </div>
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} trending={trending} placeholder={searchPlaceholder} />}
    </header>
  );
}

/* ---------- Mobile bottom nav ---------- */
export function BottomNav() {
  const pathname = usePathname();
  const { count } = useCart();
  const { user } = useAuth();
  const items = [
    { href: "/", label: "Home", icon: IC.home },
    { href: "/products", label: "Browse", icon: IC.search },
    { href: "/wishlist", label: "Saved", icon: IC.heart },
    { href: "/cart", label: "Cart", icon: IC.cart, badge: count },
    { href: user ? "/account" : "/login", label: user ? "Account" : "Sign in", icon: IC.user },
  ];
  return (
    <nav className="m-nav" aria-label="Primary">
      {items.map((it) => {
        const on = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
        return (
          <Link key={it.label} href={it.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
            {it.badge ? <span className="bdot">{it.badge}</span> : null}
            <I d={it.icon} size={20} />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

/* ---------- Floating cart bar ---------- */
export function FloatingCartBar() {
  const { cart, count } = useCart();
  const pathname = usePathname();
  if (!count || pathname === "/cart" || pathname === "/checkout") return null;
  return (
    <div className="cartbar">
      <span className="sum">
        <b>{count} item{count === 1 ? "" : "s"}</b> · {inr(cart?.totals?.grand_total)}
      </span>
      <Link href="/cart" className="go">
        View cart →
      </Link>
    </div>
  );
}

/* ---------- Footer ---------- */
export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div style={{ maxWidth: 280 }}>
          <div className="logo" style={{ marginBottom: 8 }}>
            Nethra<span>sap</span>
          </div>
          <p className="small">
            India&apos;s audited healthcare supply platform. GDP-compliant cold chain, CDSCO-verified sourcing.
          </p>
        </div>
        <div>
          <h4 className="small">Shop</h4>
          <div style={{ display: "grid", gap: 6 }} className="small">
            <Link href="/products">All products</Link>
            <Link href="/categories">Categories</Link>
            <Link href="/compare">Compare</Link>
            <Link href="/track">Track order</Link>
            <Link href="/about">About us</Link>
          </div>
        </div>
        <div>
          <h4 className="small">Account</h4>
          <div style={{ display: "grid", gap: 6 }} className="small">
            <Link href="/login">Sign in</Link>
            <Link href="/signup">Register as retailer / clinician</Link>
            <Link href="/account">My orders</Link>
            <Link href="/wishlist">Saved items</Link>
          </div>
        </div>
        <div>
          <h4 className="small">Buying for</h4>
          <div style={{ display: "grid", gap: 6 }} className="small">
            <span>Retail pharmacies</span>
            <span>Clinicians & hospitals</span>
            <span>Home care</span>
          </div>
        </div>
      </div>
      <div className="footer-bar">
        <div className="container">
          © 2026 Nethrasap. For authorised buyers only. Not a substitute for professional medical advice.
        </div>
      </div>
    </footer>
  );
}
