"use client";
/* eslint-disable */
// @ts-nocheck
// Auto-generated bundle from legacy *.jsx files. Single client module so the
// hundreds of cross-component references (declared as bare names in the
// browser-Babel original) remain in one lexical scope.
import React, { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from "react";
import { Icons as _Icons, resolveHomeIcon as _resolveHomeIcon } from "../lib/icons";
import { IMG as _IMG } from "../lib/images";

const _g: any = typeof window !== "undefined" ? window : {};
const NETHRA_DATA: any = _g.NETHRA_DATA || {};
const NETHRA_PORTAL: any = _g.NETHRA_PORTAL || {};
const IMG: any = _IMG;
const Icons: any = _Icons;
const resolveHomeIcon: any = _resolveHomeIcon;

/* ============== shell.jsx ============== */
/* ===========================================================
   SHELL — Header, Footer, MobileBottomNav, Breadcrumbs,
   PageShell, ProductTile, useReveal, useToast
   exposed on window.* so every page can pick what it needs
   =========================================================== */
// (hooks already imported at module top — original `const { useState, ... } = React;` removed to avoid TS redeclaration)

const NAV = [
  { key: "home",       label: "Home",          href: "/" },
  { key: "categories", label: "Categories",    href: "/categories" },
];

/* ----------------------------------------------------------
   Logo
---------------------------------------------------------- */
function Logo({ dark }) {
  const fg = dark ? "#fff" : "var(--ink)";
  return (
    <a href="/" className="logo" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--brand-700)" />
        <path d="M9 10.5h3.6l5.4 7.6V10.5H21v11h-3.6L12 13.9V21.5H9z" fill="#fff" />
        <circle cx="24" cy="10" r="2.2" fill="var(--brand-300)" />
      </svg>
      <span style={{ fontWeight: 600, fontSize: 17, letterSpacing: "-0.02em", color: fg }}>
        nethra<span style={{ color: "var(--brand-700)" }}>sap</span>
      </span>
    </a>
  );
}

/* ----------------------------------------------------------
   Announcement bar
---------------------------------------------------------- */
function AnnouncementBar() {
  return (
    <div className="announce">
      <div className="container announce-inner">
        <div className="announce-left">
          <span className="dot" />
          <span className="kicker">LIVE</span>
          <span className="hide-sm">Same-day dispatch on orders before 4:00 PM IST · Q2 retailer margin reset is live</span>
          <span style={{ display: "none" }} className="show-sm">Same-day dispatch · 4PM cutoff</span>
        </div>
        <div className="announce-right hide-sm">
          <a href="/track-order" className="announce-link">Track order <Icons.ArrowR size={13} stroke={2} /></a>
          <span className="announce-sep" />
          <a href="#" className="announce-link"><Icons.Phone size={13} stroke={2} /> 1800-419-7700</a>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------
   Search pill / overlay
---------------------------------------------------------- */
function SearchPill({ onOpen }) {
  return (
    <button className="search-pill" onClick={onOpen} aria-label="Search products">
      <Icons.Search size={16} stroke={1.7} />
      <span className="search-placeholder">Search 12,400 SKUs by name, salt or HSN…</span>
      <span className="search-kbd">⌘K</span>
    </button>
  );
}

function SearchOverlay({ open, onClose }) {
  const inputRef = useRef(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const popular = window.NETHRA_DATA.popularSearches;
  const submit = (e) => {
    e.preventDefault();
    const dest = "search.html?q=" + encodeURIComponent(q || "");
    window.location.href = dest;
  };
  return (
    <div className="search-overlay" onMouseDown={onClose}>
      <div className="search-overlay-card" onMouseDown={(e) => e.stopPropagation()}>
        <form onSubmit={submit} className="search-overlay-form">
          <Icons.Search size={18} stroke={1.7} />
          <input
            ref={inputRef}
            className="search-overlay-input"
            placeholder="Search 12,400 SKUs by name, salt or HSN…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <kbd className="search-kbd">ESC</kbd>
        </form>
        <div className="search-overlay-body">
          <div className="search-overlay-section">
            <div className="kicker">Popular searches</div>
            <div className="search-chips">
              {popular.map((p) => (
                <a key={p} href={"search.html?q=" + encodeURIComponent(p)} className="search-chip">{p}</a>
              ))}
            </div>
          </div>
          <div className="search-overlay-section">
            <div className="kicker">Quick links</div>
            <div className="search-quick">
              <a href="/track-order"><Icons.Truck size={14} stroke={1.8} /> Track an order</a>
              <a href="/categories"><Icons.Grid size={14} stroke={1.8} /> Browse categories</a>
              <a href="/compare"><Icons.Hash size={14} stroke={1.8} /> Compare products</a>
              <a href="/cart"><Icons.Cart size={14} stroke={1.8} /> My cart</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------
   Mega menu
---------------------------------------------------------- */
function MegaMenu({ open, onClose }) {
  if (!open) return null;
  const cats = window.NETHRA_DATA.categories;
  return (
    <div className="mega-menu" onMouseLeave={onClose}>
      <div className="container mega-grid">
        <div className="mega-col-cats">
          <div className="kicker">All categories</div>
          <ul className="mega-cat-list">
            {cats.map((c) => (
              <li key={c.id}>
                <a href={"category.html?slug=" + c.slug}>
                  <span className="mega-cat-name">{c.name}</span>
                  <span className="mega-cat-count mono">{c.product_count.toLocaleString("en-IN")}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="mega-col-feature">
          <div className="kicker">Featured</div>
          <a href="/category?slug=cold-chain" className="mega-feature-card">
            <img src={IMG.coldChain(640, 400)} alt="Cold chain warehouse" />
            <div className="mega-feature-text">
              <div className="pill pill-brand">WHO-GDP · 2–8°C</div>
              <div className="mega-feature-title">Cold-chain biologics</div>
              <div className="mega-feature-sub">184 SKUs · validated lanes</div>
            </div>
          </a>
        </div>
        <div className="mega-col-feature">
          <div className="kicker">Programs</div>
          <ul className="mega-program-list">
            <li><a href="#"><Icons.Award size={14} /> Retailer margin tiers</a></li>
            <li><a href="#"><Icons.Building size={14} /> Hospital procurement</a></li>
            <li><a href="#"><Icons.Stethoscope size={14} /> Clinician portal</a></li>
            <li><a href="#"><Icons.Package size={14} /> Bulk PO orders</a></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------
   Navbar
---------------------------------------------------------- */
function Navbar({ active, onSearch }) {
  const [scrolled, setScrolled] = useState(false);
  const [mega, setMega] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const cartCount = window.NETHRA_DATA.cartItems.reduce((s, i) => s + i.qty, 0);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSearch(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSearch]);

  return (
    <header className={"navbar" + (scrolled ? " is-scrolled" : "")}>
      <div className="container nav-inner">
        <div className="nav-left">
          <button className="icon-btn nav-mobile-btn" aria-label="Menu" onClick={() => setMobileOpen(true)}>
            <Icons.Menu size={20} />
          </button>
          <Logo />
          <nav className="nav-primary" aria-label="Primary">
            {NAV.map((n) => (
              <a key={n.key}
                 href={n.href}
                 className={"nav-link" + (active === n.key ? " is-active" : "")}
                 onMouseEnter={() => setMega(n.key === "categories")}
              >
                {n.label}
                {n.key === "categories" && <Icons.ChevD size={12} stroke={2} style={{ marginLeft: 2 }} />}
              </a>
            ))}
          </nav>
        </div>

        <div className="nav-center">
          <SearchPill onOpen={onSearch} />
        </div>

        <div className="nav-right">
          <button className="icon-btn nav-icon-mobile" aria-label="Search" onClick={onSearch}><Icons.Search size={18} /></button>
          <a className="icon-btn hide-md" href="/compare" aria-label="Compare">
            <Icons.Hash size={18} />
          </a>
          <button className="icon-btn hide-md" aria-label="Wishlist"><Icons.Heart size={18} /></button>
          <button className="icon-btn" aria-label="Notifications">
            <Icons.Bell size={18} />
            <span className="badge-dot" />
          </button>
          <a className="icon-btn nav-cart" href="/cart" aria-label="Cart">
            <Icons.Cart size={18} />
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </a>
          <span className="nav-divider hide-md" />
          <button className="lang-btn hide-md">
            <Icons.Globe size={14} stroke={1.8} />
            <span>EN</span>
            <Icons.ChevD size={12} stroke={1.8} />
          </button>
          <a className="btn btn-primary btn-sm hide-sm" href="/login">Sign in</a>
        </div>

        {mega && <MegaMenu open={mega} onClose={() => setMega(false)} />}
      </div>

      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} active={active} />
    </header>
  );
}

/* ----------------------------------------------------------
   Mobile drawer
---------------------------------------------------------- */
function MobileDrawer({ open, onClose, active }) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  if (!open) return null;
  const cats = window.NETHRA_DATA.categories;
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <Logo />
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icons.X size={18} /></button>
        </header>
        <div className="drawer-body">
          <nav className="drawer-nav">
            {NAV.map((n) => (
              <a key={n.key} href={n.href} className={"drawer-link" + (active === n.key ? " is-active" : "")}>
                {n.label}
                <Icons.ChevR size={14} stroke={2} />
              </a>
            ))}
          </nav>
          <div className="drawer-section">
            <div className="kicker">Categories</div>
            <ul className="drawer-cat-list">
              {cats.map((c) => (
                <li key={c.id}>
                  <a href={"category.html?slug=" + c.slug}>
                    {c.name}
                    <span className="mono drawer-cat-count">{c.product_count.toLocaleString("en-IN")}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="drawer-section">
            <div className="kicker">Account</div>
            <a className="drawer-link" href="/login">Sign in</a>
            <a className="drawer-link" href="/signup">Create account</a>
            <a className="drawer-link" href="/dashboard">My dashboard</a>
            <a className="drawer-link" href="/track-order">Track an order</a>
          </div>
          <div className="drawer-section">
            <div className="kicker">Internal portals</div>
            <a className="drawer-link" href="/sales-dashboard">Sales portal</a>
            <a className="drawer-link" href="/manager-dashboard">Manager portal</a>
            <a className="drawer-link" href="/admin-dashboard">Admin console</a>
          </div>
        </div>
        <footer className="drawer-foot">
          <a href="#"><Icons.Phone size={13} /> 1800-419-7700</a>
          <a href="#"><Icons.Mail size={13} /> hello@nethrasap.in</a>
        </footer>
      </aside>
    </div>
  );
}

/* ----------------------------------------------------------
   Breadcrumbs
---------------------------------------------------------- */
function Breadcrumbs({ items = [] }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <div className="container breadcrumb-inner">
        <a href="/" className="breadcrumb-link"><Icons.Home size={13} stroke={1.7} /></a>
        {items.map((it, i) => (
          <span key={i} className="breadcrumb-item">
            <Icons.ChevR size={12} stroke={1.7} className="breadcrumb-sep" />
            {it.href ? <a className="breadcrumb-link" href={it.href}>{it.label}</a> : <span className="breadcrumb-current">{it.label}</span>}
          </span>
        ))}
      </div>
    </nav>
  );
}

/* ----------------------------------------------------------
   Page header (used by category, search, etc)
---------------------------------------------------------- */
function PageHeader({ eyebrow, title, description, stats, image, dark, children }) {
  return (
    <section className={"page-header" + (dark ? " is-dark" : "") + (image ? " has-image" : "")}>
      <div className="container page-header-inner">
        <div className="page-header-text">
          {eyebrow && (
            <div className="section-eyebrow">
              <span className="bar" />
              <span className="kicker">{eyebrow}</span>
            </div>
          )}
          <h1 className="page-header-title">{title}</h1>
          {description && <p className="page-header-desc">{description}</p>}
          {children}
          {stats && (
            <div className="page-header-stats">
              {stats.map((s, i) => (
                <div key={i} className="page-header-stat">
                  <div className="page-header-stat-v mono">{s.v}</div>
                  <div className="page-header-stat-k">{s.k}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        {image && (
          <div className="page-header-image">
            <img src={image} alt="" />
            <span className="page-header-image-bracket" />
          </div>
        )}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------
   Footer
---------------------------------------------------------- */
function Footer() {
  const quickLinks = [
    { label: "Home", href: "/" },
    { label: "Products", href: "/products" },
    { label: "Categories", href: "/categories" },
    { label: "Track order", href: "/track-order" },
    { label: "Compare", href: "/compare" },
  ];
  const customer = [
    { label: "Terms of Service",  href: "/terms" },
    { label: "Privacy Policy",    href: "/privacy" },
    { label: "Refund Policy",     href: "/refund" },
    { label: "Offline mode",      href: "/offline" },
  ];
  const buyers = [
    { label: "For Retailers",      href: "#" },
    { label: "For Clinicians",     href: "#" },
    { label: "For Hospitals",      href: "#" },
    { label: "Become a supplier",  href: "#" },
  ];
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Logo dark />
          <p className="footer-desc">
            India's audited healthcare supply platform — connecting licensed manufacturers directly to pharmacies, clinics and hospital procurement teams across 50 cities.
          </p>
          <div className="footer-newsletter">
            <div className="kicker" style={{ color: "rgba(255,255,255,0.6)" }}>Weekly procurement memo</div>
            <form className="footer-form" onSubmit={(e) => e.preventDefault()}>
              <input className="footer-input" placeholder="you@pharmacy.in" type="email" />
              <button className="btn btn-sm" style={{ background: "var(--brand-500)", color: "#fff" }}>
                Subscribe <Icons.ArrowR size={13} stroke={2} />
              </button>
            </form>
          </div>
        </div>

        <div>
          <div className="footer-h">Quick links</div>
          <ul className="footer-list">{quickLinks.map((l) => <li key={l.label}><a href={l.href}>{l.label}</a></li>)}</ul>
        </div>

        <div>
          <div className="footer-h">Buyer programs</div>
          <ul className="footer-list">{buyers.map((l) => <li key={l.label}><a href={l.href}>{l.label}</a></li>)}</ul>
        </div>

        <div>
          <div className="footer-h">Policies</div>
          <ul className="footer-list">{customer.map((l) => <li key={l.label}><a href={l.href}>{l.label}</a></li>)}</ul>
          <div className="footer-contact">
            <div><Icons.Phone size={12} stroke={1.8} /> <span className="mono">1800-419-7700</span></div>
            <div><Icons.Mail size={12} stroke={1.8} /> <span className="mono">hello@nethrasap.in</span></div>
            <div><Icons.Pin size={12} stroke={1.8} /> Bhiwandi · Mumbai 03</div>
          </div>
        </div>
      </div>

      <div className="footer-bar">
        <div className="container footer-bar-inner">
          <div className="footer-bar-left">
            <span>© 2026 Nethrasap Healthcare Pvt. Ltd.</span>
            <span className="footer-bar-sep" />
            <span className="mono">CDSCO/WL/2024/MH/8810</span>
            <span className="footer-bar-sep" />
            <span className="mono">GSTIN 27AABCN9012P1Z3</span>
          </div>
          <div className="footer-bar-right">
            <a href="/terms">Terms</a>
            <a href="/privacy">Privacy</a>
            <a href="/refund">Refund</a>
            <a href="#">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ----------------------------------------------------------
   Mobile top bar (compact replacement for the desktop navbar)
---------------------------------------------------------- */
function MobileTopBar({ onSearch }) {
  const cartCount = window.NETHRA_DATA.cartItems.reduce((s, i) => s + i.qty, 0);
  return (
    <header className="navbar is-mobile-top m-top">
      <Logo />
      <button className="m-top-search" onClick={onSearch} aria-label="Search">
        <Icons.Search size={14} stroke={1.7} />
        <span className="m-top-search-text">Search 12,400 SKUs…</span>
      </button>
      <a href="/cart" className="m-top-cart" aria-label="Cart">
        <Icons.Cart size={16} stroke={1.7} />
        {cartCount > 0 && <span className="m-top-cart-badge">{cartCount}</span>}
      </a>
    </header>
  );
}

/* ----------------------------------------------------------
   Mobile bottom nav
---------------------------------------------------------- */
function MobileBottomNav({ active }) {
  const cartCount = window.NETHRA_DATA.cartItems.reduce((s, i) => s + i.qty, 0);
  // Map all known active keys (storefront + portal) to one of 5 tabs
  const TAB_MAP = {
    home: "home", products: "browse", categories: "browse", search: "browse",
    cart: "cart", track: "account", compliance: "account",
    dashboard: "account", profile: "account", addresses: "account",
    orders: "orders", enquiries: "orders", wishlist: "wishlist", notifications: "account",
  };
  const items = [
    { ic: "Home",    label: "Home",     k: "home",     href: "/" },
    { ic: "Grid",    label: "Browse",   k: "browse",   href: "/products" },
    { ic: "Heart",   label: "Saved",    k: "wishlist", href: "/wishlist" },
    { ic: "Cart",    label: "Cart",     k: "cart",     href: "/cart", badge: cartCount },
    { ic: "User",    label: "Account",  k: "account",  href: "/dashboard" },
  ];
  const currentTab = TAB_MAP[active] || active || "home";
  return (
    <nav className="m-nav" aria-label="Mobile">
      {items.map((it) => {
        const Icon = Icons[it.ic];
        const isActive = currentTab === it.k;
        return (
          <a key={it.k} href={it.href} className={"m-nav-item" + (isActive ? " is-active" : "")}>
            <span className="m-nav-ic">
              <Icon size={19} stroke={1.7} />
              {it.badge ? <span className="m-nav-badge">{it.badge}</span> : null}
            </span>
            <span className="m-nav-label">{it.label}</span>
          </a>
        );
      })}
    </nav>
  );
}

/* ----------------------------------------------------------
   Page shell — wraps everything
---------------------------------------------------------- */
function PageShell({ active, hideMobileNav, children }) {
  const [searchOpen, setSearchOpen] = useState(false);
  // mount reveal-on-scroll observer for any .reveal element
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in"); obs.unobserve(e.target); }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });
    document.querySelectorAll(".reveal").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  });
  return (
    <>
      <AnnouncementBar />
      <Navbar active={active} onSearch={() => setSearchOpen(true)} />
      <MobileTopBar onSearch={() => setSearchOpen(true)} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <main className="page-main">{children}</main>
      <Footer />
      {!hideMobileNav && <MobileBottomNav active={active} />}
    </>
  );
}

/* ----------------------------------------------------------
   Helpers
---------------------------------------------------------- */
function getQuery(name) {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

function inr(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function findProduct(id) {
  return window.NETHRA_DATA.products.find((p) => p.id === id);
}

/* ----------------------------------------------------------
   Toast
---------------------------------------------------------- */
let toastSetter = null;
function ToastHost() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => { toastSetter = setToasts; return () => { toastSetter = null; }; }, []);
  return (
    <div className="toast-host">
      {toasts.map((t) => (
        <div key={t.id} className={"toast" + (t.kind ? " toast-" + t.kind : "")}>
          <Icons.Check size={14} stroke={2.4} />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
function toast(message, kind) {
  if (!toastSetter) return;
  const id = Math.random().toString(36).slice(2);
  toastSetter((arr) => [...arr, { id, message, kind }]);
  setTimeout(() => { toastSetter && toastSetter((arr) => arr.filter((x) => x.id !== id)); }, 2400);
}

if (typeof window !== "undefined") Object.assign(window, {
  Logo, Navbar, AnnouncementBar, Footer, MobileBottomNav,
  Breadcrumbs, PageHeader, PageShell, ToastHost,
  getQuery, inr, findProduct, toast,
});

/* ============== product-card.jsx ============== */
/* ===========================================================
   Reusable ProductCard / ProductTile / Rating / Quantity
   =========================================================== */
const { useState: pcUseState } = React;

function ProductTile({ product, size = "md" }) {
  // Generates a category-tinted SVG placeholder with brand monogram
  const cat = (window.NETHRA_DATA.categories.find((c) => c.slug === product.category_slug)) || {};
  const Glyph = Icons[cat.glyph || "Pill"];
  return (
    <div className={"prod-tile prod-tile-" + size}>
      <div className="prod-tile-glyph">
        <Glyph size={size === "sm" ? 26 : size === "lg" ? 56 : 38} stroke={1.4} />
        <div className="brand">{product.brand}</div>
      </div>
    </div>
  );
}

function StarRating({ value = 0, count, size = 12 }) {
  const full = Math.round(value);
  return (
    <div className="star-rating" style={{ "--s": size + "px" }}>
      {[1,2,3,4,5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9 4.7 17.6l1-5.8L1.5 7.7l5.9-.9z"
                fill={i <= full ? "var(--brand-700)" : "none"}
                stroke={i <= full ? "var(--brand-700)" : "#d6d2c5"}
                strokeWidth="1.5"
                strokeLinejoin="round"/>
        </svg>
      ))}
      {value > 0 && <span className="star-rating-v mono">{value.toFixed(1)}</span>}
      {count != null && <span className="star-rating-c">({count.toLocaleString("en-IN")})</span>}
    </div>
  );
}

function Quantity({ value, onChange, min = 1, max = 99 }) {
  return (
    <div className="qty">
      <button className="qty-btn" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} aria-label="Decrease">
        <Icons.X size={10} stroke={2} style={{ transform: "rotate(45deg)" }} />
      </button>
      <input
        type="number"
        className="qty-input mono"
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
      <button className="qty-btn" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} aria-label="Increase">
        <Icons.Plus size={10} stroke={2} />
      </button>
    </div>
  );
}

const STOCK_PILL = {
  in_stock:     { cls: "pill-emerald", label: "In stock" },
  low_stock:    { cls: "pill-amber",   label: "Low stock" },
  out_of_stock: { cls: "pill-rose",    label: "Out of stock" },
  discontinued: { cls: "pill",         label: "Discontinued" },
};

function ProductCard({ product, layout = "grid" }) {
  const [added, setAdded] = pcUseState(false);
  const p = product;
  const stock = STOCK_PILL[p.stock_status] || STOCK_PILL.in_stock;
  const isOut = p.stock_status === "out_of_stock";
  const priced = p.price_min === p.price_max ? inr(p.price_min) : `${inr(p.price_min)} – ${inr(p.price_max)}`;
  const href = "/product?slug=" + p.slug;

  if (layout === "list") {
    return (
      <article className="prod-card prod-card-list">
        <a href={href} className="prod-card-list-img">
          <ProductTile product={p} size="md" />
          {p.badge && <span className="prod-badge mono">{p.badge}</span>}
        </a>
        <div className="prod-card-list-body">
          <div className="prod-meta-row">
            <span className={"pill " + stock.cls}>{stock.label}</span>
            <span className="mono prod-cat">{p.category_name}</span>
            {p.delivery_time_mins && (
              <span className="prod-delivery-inline mono">
                <Icons.Clock size={11} stroke={2} /> {p.delivery_time_mins} MIN
              </span>
            )}
          </div>
          <a href={href}><h3 className="prod-name prod-name-list">{p.name}</h3></a>
          <div className="prod-sub">
            <span className="prod-brand">{p.brand}</span>
            <span className="prod-dot">·</span>
            <span className="prod-unit">{p.unit_label}</span>
            <span className="prod-dot">·</span>
            <StarRating value={p.rating} count={p.reviews} />
          </div>
        </div>
        <div className="prod-card-list-foot">
          <div className="prod-price-label kicker">UNIT PRICE</div>
          <div className="prod-price">{priced}</div>
          {isOut ? (
            <button className="btn btn-outline btn-sm" disabled>Notify</button>
          ) : (
            <button className={"btn btn-sm prod-add" + (added ? " is-added" : "")} onClick={() => { setAdded(true); window.toast && window.toast("Added to cart"); setTimeout(() => setAdded(false), 1400); }}>
              {added ? <><Icons.Check size={14} stroke={2.4} /> Added</> : <><Icons.Plus size={14} stroke={2.2} /> Add to cart</>}
            </button>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className="prod-card">
      <a href={href} className="prod-img-link">
        <div className="prod-img">
          <ProductTile product={p} size="md" />
          {p.badge && <span className="prod-badge mono">{p.badge}</span>}
          <button className="prod-wish" aria-label="Save to wishlist" onClick={(e) => { e.preventDefault(); window.toast && window.toast("Saved to wishlist"); }}>
            <Icons.Heart size={15} stroke={1.7} />
          </button>
          {p.delivery_time_mins && (
            <span className="prod-delivery mono">
              <Icons.Clock size={11} stroke={2} /> {p.delivery_time_mins} MIN
            </span>
          )}
          {isOut && (
            <div className="prod-out">
              <span className="mono">OUT OF STOCK · NOTIFY ME</span>
            </div>
          )}
        </div>
      </a>

      <div className="prod-body">
        <div className="prod-meta-row">
          <span className={"pill " + stock.cls}>{stock.label}</span>
          <span className="mono prod-cat">{p.category_name}</span>
        </div>
        <a href={href}><h3 className="prod-name">{p.name}</h3></a>
        <div className="prod-sub">
          <span className="prod-brand">{p.brand}</span>
          <span className="prod-dot">·</span>
          <span className="prod-unit">{p.unit_label}</span>
        </div>
        <StarRating value={p.rating} count={p.reviews} />

        <div className="prod-foot">
          <div>
            <div className="prod-price-label kicker">UNIT PRICE</div>
            <div className="prod-price">{priced}</div>
          </div>
          {isOut ? (
            <button className="btn btn-outline btn-sm" disabled style={{ opacity: 0.55 }}>Notify</button>
          ) : (
            <button
              className={"btn btn-sm prod-add" + (added ? " is-added" : "")}
              onClick={(e) => { e.preventDefault(); setAdded(true); window.toast && window.toast("Added to cart"); setTimeout(() => setAdded(false), 1400); }}
            >
              {added ? <><Icons.Check size={14} stroke={2.4} /> Added</> : <><Icons.Plus size={14} stroke={2.2} /> Add</>}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

if (typeof window !== "undefined") Object.assign(window, { ProductCard, ProductTile, StarRating, Quantity, STOCK_PILL });

/* ============== chatbot.jsx ============== */
/* ===========================================================
   Chatbot — Nethra Assist
   Scripted conversational helper. Handles:
     • order status lookup
     • product availability / pricing
     • payment confirmation
     • delivery tracking + handoff to support
   =========================================================== */
const { useState: cbUS, useEffect: cbUE, useRef: cbUR, useMemo: cbUM } = React;

const QUICK_FIRST = [
  "Track an order",
  "Check product availability",
  "Payment status",
  "Talk to a sales rep",
];

function timeNow() {
  const d = new Date();
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return h + ":" + m + " " + ampm;
}

function fmtInr(n) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }

/* Build a contextual reply for an incoming user message. Returns either:
   - { text, card?, suggestions? }
   - an array of those if the bot wants to send a sequence. */
function botReply(input, state) {
  const D = window.NETHRA_DATA;
  const text = (input || "").toLowerCase().trim();

  // ---- explicit order id lookup
  const idMatch = text.match(/ns-?\d{4}-?\d{4}-?[a-z0-9]{4}/i);
  if (idMatch) {
    const id = idMatch[0].toUpperCase().replace(/\s/g, "");
    const order = D.userOrders.find((o) => o.id.toUpperCase().replace(/-/g, "") === id.replace(/-/g, ""));
    if (order) return orderStatusReply(order);
    return { text: `I couldn't find an order with ID ${id}. Could you double-check the reference? It looks like NS-YYYY-MMDD-XXXX.` };
  }

  // ---- intents
  if (/^(hi|hello|hey|hola|good\s+(morning|evening|afternoon))/.test(text)) {
    return {
      text: `Hi ${D.currentUser.full_name.split(" ")[0]}! How can I help today? I can check order status, product stock, payment, or hand you off to a sales rep.`,
      suggestions: QUICK_FIRST,
    };
  }
  if (/track|status|order|where.*order/.test(text)) {
    const open = D.userOrders.filter((o) => o.status !== "delivered" && o.status !== "cancelled");
    if (open.length === 0) {
      return { text: "You don't have any open orders right now. Want help placing a new one?", suggestions: ["Browse catalog", "Check product availability"] };
    }
    const o = open[0];
    return orderStatusReply(o, true);
  }
  if (/availab|in.stock|stock|do.you.have|got/.test(text)) {
    return {
      text: "Sure — what product are you looking for? Try the brand or salt (e.g. *Insulin Glargine*, *Pulse Oximeter*, *Amoxicillin 500mg*).",
      suggestions: D.popularSearches.slice(0, 4),
    };
  }
  if (/pay|paid|payment|invoice|receipt/.test(text)) {
    const recent = D.userOrders[0];
    return paymentReply(recent);
  }
  if (/deliver|courier|rider|out.for|where.*driver|reach/.test(text)) {
    const order = D.userOrders.find((o) => o.status === "out_for_delivery") || D.userOrders[0];
    return deliveryReply(order);
  }
  if (/return|refund|damaged/.test(text)) {
    return {
      text: "Returns are open for 7 days from delivery on most lines. Damage claims are credited within 48 hours of evidence. Would you like to start a return?",
      suggestions: ["Start a return", "View refund policy"],
    };
  }
  if (/sales|rep|human|agent|person|call/.test(text)) {
    return {
      text: "Connecting you with a sales rep. Aarav Sharma usually replies within 4 minutes during business hours.\n\nIn the meantime, you can reach us at:",
      card: [
        { k: "Phone", v: "1800-419-7700" },
        { k: "Email", v: "support@nethrasap.in" },
        { k: "Reply window", v: "Mon-Sat · 9 AM – 7 PM IST" },
      ],
      suggestions: ["Wait for sales rep", "Back to bot"],
    };
  }
  if (/account|profile|address|password|sign\s?in/.test(text)) {
    return {
      text: "You can manage all that from your dashboard.",
      suggestions: ["My profile", "Addresses", "My orders"],
    };
  }
  if (/thank|thanks|cheers|great|nice/.test(text)) {
    return { text: "Happy to help. Anything else?", suggestions: QUICK_FIRST };
  }
  if (/cancel/.test(text)) {
    return { text: "Got it — cancellations are available before dispatch. Once an order is *out for delivery* we can only mark it as a refused-on-arrival return. Which order would you like to cancel?", suggestions: ["My orders"] };
  }

  // ---- fuzzy match a product name from the text
  if (text.length > 2) {
    const hit = D.products.find((p) =>
      p.name.toLowerCase().includes(text) ||
      p.brand.toLowerCase().includes(text) ||
      (p.sub_category || "").toLowerCase().includes(text)
    );
    if (hit) return productReply(hit);
  }

  // ---- fallback
  return {
    text: "I'm not sure I caught that. I can help with orders, product availability, payment, delivery tracking, or refunds. Try one of these:",
    suggestions: QUICK_FIRST,
  };
}

function orderStatusReply(order, isLatest) {
  const D = window.NETHRA_DATA;
  const stageLabel = {
    placed: "Order placed",
    confirmed: "Confirmed by warehouse",
    dispatched: "Dispatched · in transit",
    out_for_delivery: "Out for delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
  }[order.status] || order.status;
  const itemsLine = order.items.map((it) => {
    const p = window.findProduct(it.product_id);
    return p ? `· ${it.qty} × ${p.name}` : "";
  }).filter(Boolean).join("\n");

  return [
    {
      text: (isLatest ? "Here's your latest open order — " : "") +
            `Order ${order.id} is **${stageLabel}**.`,
      card: [
        { k: "Status",   v: stageLabel },
        { k: "Items",    v: order.items.length + " line items" },
        { k: "Total",    v: fmtInr(order.total) },
        { k: "ETA",      v: order.eta || "—" },
        { k: "Payment",  v: order.payment_method },
      ],
      suggestions: ["Track on map", "Payment status", "Need to cancel"],
    },
    { text: "Lines on this order:\n\n" + itemsLine + "\n\nNeed anything specific?", suggestions: ["Track on map", "Talk to sales rep"] },
  ];
}

function productReply(p) {
  const stockLabel = { in_stock: "in stock", low_stock: "low stock — only a few left", out_of_stock: "currently out of stock" }[p.stock_status];
  const stockText = p.stock_status === "in_stock"
    ? `✓ ${p.name} is **in stock** — ${p.delivery_time_mins || 30} min dispatch.`
    : p.stock_status === "low_stock"
      ? `⚠ ${p.name} is on **low stock**. I'd recommend placing an order soon.`
      : `✗ ${p.name} is **out of stock** right now. I can notify you when it returns.`;
  return {
    text: stockText,
    card: [
      { k: "Brand",    v: p.brand },
      { k: "Pack",     v: p.unit_label },
      { k: "Price",    v: fmtInr(p.price_min) + (p.price_max !== p.price_min ? "–" + fmtInr(p.price_max) : "") },
      { k: "Category", v: p.category_name },
    ],
    suggestions: p.stock_status === "out_of_stock"
      ? ["Notify me", "Suggest an alternative"]
      : ["Add to cart", "View product", "Place an order"],
  };
}

function paymentReply(order) {
  if (!order) return { text: "No recent orders to look up payment on. Want to start one?", suggestions: ["Browse catalog"] };
  const paid = order.status !== "cancelled";
  return {
    text: paid
      ? `Payment for order **${order.id}** has been **received and reconciled**.`
      : `The payment for order **${order.id}** was **refunded** after cancellation.`,
    card: [
      { k: "Order",   v: order.id },
      { k: "Method",  v: order.payment_method },
      { k: "Amount",  v: fmtInr(order.total) },
      { k: "Status",  v: paid ? "PAID · Reconciled" : "REFUNDED" },
      { k: "GSTIN",   v: "27AABCN9012P1Z3" },
    ],
    suggestions: ["Download invoice", "Email me the receipt", "Track order"],
  };
}

function deliveryReply(order) {
  if (!order) return { text: "No delivery to track right now." };
  if (order.status === "out_for_delivery") {
    return {
      text: `Order **${order.id}** is **out for delivery**. Your rider is Sandeep K. — ETA **${order.eta}**.`,
      card: [
        { k: "Carrier",   v: "Delhivery" },
        { k: "AWB",       v: "2840147219" },
        { k: "Rider",     v: "Sandeep K." },
        { k: "Rider ph.", v: "+91 98674 32109" },
        { k: "ETA",       v: order.eta },
      ],
      suggestions: ["Track on map", "Call rider", "Reschedule delivery"],
    };
  }
  return {
    text: `Order **${order.id}** is **${order.status.replace(/_/g, " ")}** — ETA ${order.eta}.`,
    suggestions: ["Track on map", "Talk to sales rep"],
  };
}

/* ----- Component ----- */
function ChatBubble({ msg }) {
  return (
    <div className={"chat-row " + (msg.from === "user" ? "is-user" : "is-bot")}>
      {msg.from === "bot" && <div className="chat-row-avatar">N</div>}
      <div>
        <div className="chat-bubble">
          {msg.text && <Markdownish text={msg.text} />}
          {msg.card && (
            <div className="chat-card">
              {msg.card.map((row, i) => (
                <div key={i} className="chat-card-row">
                  <span>{row.k}</span><span className="mono">{row.v}</span>
                </div>
              ))}
            </div>
          )}
          {msg.suggestions && (
            <div className="chat-suggestions">
              {msg.suggestions.map((s, i) => (
                <button key={i} className="chat-suggestion" onClick={() => msg.onSuggestion(s)}>{s}</button>
              ))}
            </div>
          )}
          <div className="chat-bubble-time">{msg.time}</div>
        </div>
      </div>
    </div>
  );
}

function Markdownish({ text }) {
  // Tiny **bold** + line-break renderer
  const parts = [];
  const lines = text.split("\n");
  lines.forEach((line, li) => {
    const tokens = line.split(/(\*\*[^*]+\*\*)/g);
    tokens.forEach((t, i) => {
      if (/^\*\*[^*]+\*\*$/.test(t)) parts.push(<strong key={li + "-" + i}>{t.slice(2, -2)}</strong>);
      else parts.push(<span key={li + "-" + i}>{t}</span>);
    });
    if (li < lines.length - 1) parts.push(<br key={"br-" + li} />);
  });
  return <>{parts}</>;
}

function ChatBot() {
  const [open, setOpen] = cbUS(false);
  const [messages, setMessages] = cbUS([]);
  const [input, setInput] = cbUS("");
  const [typing, setTyping] = cbUS(false);
  const scrollRef = cbUR(null);

  // seed welcome message lazily
  cbUE(() => {
    if (open && messages.length === 0) {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        pushBot({
          text: `Hi ${window.NETHRA_DATA.currentUser.full_name.split(" ")[0]} — I'm **Nethra Assist**. I can check order status, product stock, payment & delivery, or hand you off to a sales rep. How can I help?`,
          suggestions: QUICK_FIRST,
        });
      }, 600);
    }
  }, [open]);

  cbUE(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  const pushUser = (text) => {
    setMessages((m) => [...m, { from: "user", text, time: timeNow(), id: Date.now() + Math.random() }]);
  };
  const pushBot = (payload) => {
    const arr = Array.isArray(payload) ? payload : [payload];
    arr.forEach((p, i) => {
      setTimeout(() => {
        setMessages((m) => [...m, { from: "bot", ...p, onSuggestion: handleSuggestion, time: timeNow(), id: Date.now() + Math.random() }]);
      }, i * 350);
    });
  };

  const send = (text) => {
    const v = (text || "").trim();
    if (!v) return;
    pushUser(v);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      const reply = botReply(v);
      pushBot(reply);
    }, 750 + Math.random() * 500);
  };

  const handleSuggestion = (s) => send(s);

  const unread = open ? 0 : 1;

  return (
    <>
      {!open && (
        <button className="chat-fab" onClick={() => setOpen(true)} aria-label="Open chatbot">
          <span className="chat-fab-pulse" />
          <Icons.Mail size={22} stroke={1.7} />
          {unread > 0 && <span className="chat-fab-badge">{unread}</span>}
        </button>
      )}
      {open && (
        <>
          <div className="chat-backdrop" onClick={() => setOpen(false)} />
          <div className="chat-drawer" role="dialog" aria-label="Chat with Nethra Assist">
            <header className="chat-head">
              <div className="chat-head-avatar">N</div>
              <div className="chat-head-text">
                <div className="chat-head-name">Nethra Assist
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, padding: "2px 6px", background: "var(--clay)", color: "var(--brand-900)", borderRadius: 4, fontWeight: 700 }}>BETA</span>
                </div>
                <div className="chat-head-status">◌ Online · usually replies in seconds</div>
              </div>
              <button className="chat-head-close" onClick={() => setOpen(false)} aria-label="Close">
                <Icons.X size={16} stroke={2} />
              </button>
            </header>

            <div className="chat-body" ref={scrollRef}>
              {messages.map((m) => <ChatBubble key={m.id} msg={m} />)}
              {typing && (
                <div className="chat-row is-bot">
                  <div className="chat-row-avatar">N</div>
                  <div className="chat-bubble" style={{ padding: 0 }}>
                    <div className="chat-typing"><span /><span /><span /></div>
                  </div>
                </div>
              )}
            </div>

            <form className="chat-foot" onSubmit={(e) => { e.preventDefault(); send(input); }}>
              <input
                className="chat-input"
                placeholder="Type a message…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button className="chat-send" type="submit" disabled={!input.trim()} aria-label="Send">
                <Icons.ArrowR size={16} stroke={2.2} />
              </button>
            </form>
          </div>
        </>
      )}
    </>
  );
}

if (typeof window !== "undefined") (window as any).ChatBot = ChatBot;

/* ============== portal-shell.jsx ============== */
/* ===========================================================
   PortalShell — sidebar layout shared by all 4 portals.
   Usage:
     <PortalShell portal="user|sales|manager|admin" active="dashboard"
                  breadcrumbs={[{label:"...",href:"..."}]}>
       <PageContent />
     </PortalShell>
   =========================================================== */
const { useState: psUS, useEffect: psUE } = React;

const PORTAL_CONFIG = {
  user: {
    label: "Customer dashboard",
    role: "Customer",
    sections: [
      { label: "Account", items: [
        { k: "dashboard",     label: "Overview",      icon: "Home",      href: "/dashboard" },
        { k: "profile",       label: "My profile",    icon: "User",      href: "/profile" },
        { k: "addresses",     label: "Addresses",     icon: "Pin",       href: "/addresses" },
      ]},
      { label: "Activity", items: [
        { k: "orders",        label: "My orders",     icon: "Package",   href: "/my-orders",       badge: 3 },
        { k: "enquiries",     label: "Enquiries",     icon: "Help",      href: "/my-enquiries",    badge: 2 },
        { k: "wishlist",      label: "Wishlist",      icon: "Heart",     href: "/wishlist" },
        { k: "notifications", label: "Notifications", icon: "Bell",      href: "/my-notifications", badge: 3 },
      ]},
    ],
  },
  sales: {
    label: "Sales portal",
    role: "Sales rep",
    sections: [
      { label: "Overview", items: [
        { k: "dashboard",     label: "Dashboard",     icon: "Home",         href: "/sales-dashboard" },
      ]},
      { label: "Pipeline", items: [
        { k: "customers",     label: "Customers",     icon: "Users",        href: "/customers" },
        { k: "orders",        label: "Orders",        icon: "Package",      href: "/sales-orders",       badge: 18 },
        { k: "enquiries",     label: "Enquiries",     icon: "Help",         href: "/sales-enquiries",    badge: 5 },
        { k: "verifications", label: "Verifications", icon: "ShieldCheck",  href: "/verifications",      badge: 3 },
      ]},
      { label: "Performance", items: [
        { k: "products",      label: "Products",      icon: "Grid",         href: "/sales-products" },
        { k: "team",          label: "Team",          icon: "Award",        href: "/sales-team" },
        { k: "reports",       label: "Reports",       icon: "Calendar",     href: "/sales-reports" },
      ]},
      { label: "Personal", items: [
        { k: "notifications", label: "Notifications", icon: "Bell",         href: "/sales-notifications", badge: 4 },
      ]},
    ],
  },
  manager: {
    label: "Manager portal",
    role: "Manager",
    sections: [
      { label: "Overview", items: [
        { k: "dashboard",     label: "Dashboard",     icon: "Home",         href: "/manager-dashboard" },
        { k: "analytics",     label: "Analytics",     icon: "Calendar",     href: "/manager-analytics" },
      ]},
      { label: "Pipeline", items: [
        { k: "orders",        label: "Orders",        icon: "Package",      href: "/manager-orders" },
        { k: "enquiries",     label: "Enquiries",     icon: "Help",         href: "/sales-enquiries" },
        { k: "verifications", label: "Verifications", icon: "ShieldCheck",  href: "/verifications" },
      ]},
      { label: "Team", items: [
        { k: "team",          label: "Team",          icon: "Users",        href: "/manager-team" },
        { k: "performance",   label: "Performance",   icon: "Award",        href: "manager-team.html#perf" },
      ]},
      { label: "Personal", items: [
        { k: "notifications", label: "Notifications", icon: "Bell",         href: "/sales-notifications" },
        { k: "settings",      label: "Settings",      icon: "Sparkle",      href: "/admin-settings" },
      ]},
    ],
  },
  admin: {
    label: "Admin console",
    role: "Admin",
    sections: [
      { label: "Overview", items: [
        { k: "dashboard",     label: "Dashboard",     icon: "Home",         href: "/admin-dashboard" },
        { k: "analytics",     label: "Analytics",     icon: "Calendar",     href: "/admin-analytics" },
      ]},
      { label: "Users & roles", items: [
        { k: "users",         label: "Users",         icon: "Users",        href: "/admin-users" },
        { k: "roles",         label: "Roles",         icon: "ShieldCheck",  href: "/admin-roles" },
      ]},
      { label: "Catalog", items: [
        { k: "products",      label: "Products",      icon: "Grid",         href: "/admin-products" },
        { k: "categories",    label: "Categories",    icon: "Package",      href: "/admin-categories" },
        { k: "inventory",     label: "Inventory",     icon: "Beaker",       href: "/admin-inventory",   badge: 4 },
      ]},
      { label: "Operations", items: [
        { k: "orders",        label: "Orders",        icon: "Package",      href: "/admin-orders" },
        { k: "enquiries",     label: "Enquiries",     icon: "Help",         href: "/admin-enquiries" },
        { k: "cms",           label: "CMS",           icon: "Building",     href: "/admin-cms" },
      ]},
      { label: "HR", items: [
        { k: "employees",     label: "Employees",     icon: "Users",        href: "/hr-employees" },
        { k: "leave",         label: "Leave",         icon: "Calendar",     href: "/hr-leave",            badge: 3 },
        { k: "payroll",       label: "Payroll",       icon: "BadgeCheck",   href: "/hr-payroll" },
        { k: "holidays",      label: "Holidays",      icon: "Sparkle",      href: "/hr-holidays" },
      ]},
      { label: "System", items: [
        { k: "notifications", label: "Notifications", icon: "Bell",         href: "/admin-notifications" },
        { k: "settings",      label: "Settings",      icon: "Sparkle",      href: "/admin-settings" },
      ]},
    ],
  },
};

function PortalSideLink({ item, active }) {
  const Icon = Icons[item.icon] || Icons.Sparkle;
  return (
    <a href={item.href} className={"portal-side-link" + (active === item.k ? " is-active" : "")}>
      <span className="portal-side-link-ic"><Icon size={17} stroke={1.7} /></span>
      <span>{item.label}</span>
      {item.badge ? <span className="portal-side-link-badge">{item.badge}</span> : null}
    </a>
  );
}

function PortalSidebar({ portal, active, collapsed, onCollapse }) {
  const cfg = PORTAL_CONFIG[portal];
  const user = window.NETHRA_DATA.currentUser;
  return (
    <aside className="portal-sidebar">
      <div className="portal-sidebar-top">
        <Logo dark />
        <button className="portal-sidebar-collapse" onClick={onCollapse} aria-label="Collapse">
          {collapsed
            ? <Icons.ChevR size={14} stroke={2} />
            : <Icons.ChevL size={14} stroke={2} />}
        </button>
      </div>

      <nav className="portal-side-nav">
        {cfg.sections.map((s, i) => (
          <React.Fragment key={i}>
            <div className="portal-side-label">{s.label}</div>
            {s.items.map((it) => <PortalSideLink key={it.k} item={it} active={active} />)}
          </React.Fragment>
        ))}
        <div className="portal-side-divider" />
        <a href="/" className="portal-side-link">
          <span className="portal-side-link-ic"><Icons.ExtLink size={17} stroke={1.7} /></span>
          <span>Visit storefront</span>
        </a>
      </nav>
      <div className="portal-side-foot">
        <div className="portal-side-avatar">{user.avatar_initials}</div>
        <div className="portal-side-user">
          <div className="portal-side-user-name">{user.full_name}</div>
          <div className="portal-side-user-role">{cfg.role}</div>
        </div>
        <a className="portal-side-user-action" href="/login" aria-label="Sign out" title="Sign out">
          <Icons.Logout size={14} stroke={1.8} />
        </a>
      </div>
    </aside>
  );
}

function PortalHeader({ breadcrumbs, onMobileOpen }) {
  return (
    <header className="portal-header">
      <button className="portal-header-mobile-btn" onClick={onMobileOpen} aria-label="Open menu">
        <Icons.Menu size={18} />
      </button>
      <nav className="portal-breadcrumb" aria-label="Breadcrumb">
        {breadcrumbs && breadcrumbs.map((b, i) => (
          <React.Fragment key={i}>
            {i > 0 && <Icons.ChevR size={11} stroke={1.7} style={{ color: "var(--ink-3)" }} />}
            {b.href && i < breadcrumbs.length - 1
              ? <a href={b.href} style={{ color: "var(--ink-3)" }}>{b.label}</a>
              : <span className={i === breadcrumbs.length - 1 ? "portal-breadcrumb-current" : ""}>{b.label}</span>}
          </React.Fragment>
        ))}
      </nav>
      <div className="portal-search">
        <Icons.Search size={14} stroke={1.7} />
        <input placeholder="Search this portal…" />
        <span className="portal-search-kbd">⌘K</span>
      </div>
      <div className="portal-header-actions">
        <button className="icon-btn" aria-label="Help"><Icons.Help size={16} /></button>
        <a className="icon-btn" href="/my-notifications" aria-label="Notifications">
          <Icons.Bell size={16} />
          <span className="badge-dot" />
        </a>
      </div>
    </header>
  );
}

function PortalShell({ portal, active, breadcrumbs, children }) {
  const [collapsed, setCollapsed] = psUS(false);
  const [mobileOpen, setMobileOpen] = psUS(false);
  psUE(() => {
    const onResize = () => { if (window.innerWidth > 1000) setMobileOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return (
    <div className={"portal-shell" + (collapsed ? " is-collapsed" : "") + (mobileOpen ? " is-mobile-open" : "")}
         onClick={(e) => {
           if (mobileOpen && !e.target.closest(".portal-sidebar") && !e.target.closest(".portal-header-mobile-btn")) {
             setMobileOpen(false);
           }
         }}>
      <PortalSidebar portal={portal} active={active}
                     collapsed={collapsed}
                     onCollapse={() => setCollapsed((v) => !v)} />
      <div className="portal-main">
        <PortalHeader breadcrumbs={breadcrumbs} onMobileOpen={() => setMobileOpen(true)} />
        <div className="portal-page">{children}</div>
        {portal === "user" && <MobileBottomNav active={active} />}
      </div>
    </div>
  );
}

/* ===== Helpers ===== */
function KpiCard({ label, value, delta, icon, kicker, tip }) {
  const Icon = Icons[icon] || Icons.Sparkle;
  const auto = tip || (delta != null
    ? `${label} · ${delta >= 0 ? "+" : ""}${delta}% ${kicker || ""}`.trim()
    : `${label} · current value ${value}`);
  return (
    <div className="kpi-card" data-tooltip={auto}>
      <div className="kpi-card-top">
        <span className="kpi-card-label">{label}</span>
        <span className="kpi-card-ic"><Icon size={14} stroke={1.8} /></span>
      </div>
      <div className="kpi-card-value">{value}</div>
      {delta != null && (
        <div className={"kpi-card-delta " + (delta >= 0 ? "up" : "down")}>
          <span className="kpi-card-delta-num">{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%</span>
          {kicker && <span className="kpi-card-delta-kicker">{kicker}</span>}
        </div>
      )}
    </div>
  );
}

function Panel({ title, sub, action, children, foot }) {
  return (
    <section className="panel">
      {title && (
        <header className="panel-head">
          <div>
            <div className="panel-title">{title}</div>
            {sub && <div className="panel-sub">{sub}</div>}
          </div>
          {action}
        </header>
      )}
      <div className="panel-body">{children}</div>
      {foot && <footer className="panel-foot">{foot}</footer>}
    </section>
  );
}

function FilterBar({ children }) {
  return <div className="filter-bar">{children}</div>;
}

function EmptyPanel({ icon = "Search", title, desc, actions }) {
  const Icon = Icons[icon] || Icons.Search;
  return (
    <div className="empty">
      <div className="empty-ic"><Icon size={26} stroke={1.6} /></div>
      <div className="empty-title">{title}</div>
      {desc && <div className="empty-desc">{desc}</div>}
      {actions && <div className="empty-actions">{actions}</div>}
    </div>
  );
}

function StatusPill({ status }) {
  const labels = {
    active: "Active", suspended: "Suspended", pending: "Pending",
    approved: "Approved", rejected: "Rejected", leave: "On leave",
    processed: "Processed", expired: "Expired", confirmed: "Confirmed",
    delivered: "Delivered", dispatched: "Dispatched", cancelled: "Cancelled",
    out_for_delivery: "Out for delivery", checked_out: "Checked out", inactive: "Inactive",
  };
  return <span className={"pill pill-status-" + status}>{labels[status] || status}</span>;
}

function Sparkline({ data, color = "var(--brand-700)", height = 36 }) {
  if (!data || !data.length) return null;
  const max = Math.max(...data), min = Math.min(...data);
  const range = Math.max(1, max - min);
  const w = 100;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" width="100%" height={height} style={{ display: "block" }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* Bar chart (horizontal) */
function BarRow({ name, value, max, format }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="bar-row">
      <div className="bar-row-name">{name}</div>
      <div className="bar-row-track"><div className="bar-row-fill" style={{ width: pct + "%" }} /></div>
      <div className="bar-row-value">{format ? format(value) : value}</div>
    </div>
  );
}

/* Render a simple line chart (responsive) */
function LineChart({ data, height = 200, label }) {
  if (!data || !data.length) return null;
  const max = Math.max(...data), min = Math.min(...data) * 0.92;
  const range = Math.max(1, max - min);
  const w = 800, h = height;
  const margin = 16;
  const points = data.map((v, i) => {
    const x = margin + (i / (data.length - 1)) * (w - margin * 2);
    const y = h - margin - ((v - min) / range) * (h - margin * 2);
    return [x, y];
  });
  const pathLine = points.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const pathArea = pathLine + ` L ${w - margin} ${h - margin} L ${margin} ${h - margin} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height }}>
      <defs>
        <linearGradient id="lcGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--chart-area-from)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--chart-area-to)" stopOpacity="1" />
        </linearGradient>
      </defs>
      {/* gridlines */}
      {[0,0.25,0.5,0.75,1].map((t, i) => (
        <line key={i} x1={margin} x2={w - margin} y1={margin + t*(h-margin*2)} y2={margin + t*(h-margin*2)} stroke="var(--line)" strokeWidth="1" strokeDasharray="2 4" />
      ))}
      <path d={pathArea} fill="url(#lcGrad)" />
      <path d={pathLine} fill="none" stroke="var(--chart-line)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* dots */}
      {points.filter((_, i) => i === points.length - 1).map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="#fff" stroke="var(--chart-line)" strokeWidth="2" />
      ))}
    </svg>
  );
}

/* Pie / donut chart (simple) */
function DonutChart({ data, size = 160 }) {
  // data = [{ label, value, color }]
  const total = data.reduce((s, d) => s + d.value, 0);
  let offset = 0;
  const r = (size / 2) - 8;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--paper-3)" strokeWidth="14" />
        {data.map((d, i) => {
          const len = (d.value / total) * c;
          const dasharray = `${len} ${c - len}`;
          const dashoffset = -offset;
          offset += len;
          return (
            <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
                    stroke={d.color || "var(--brand-700)"}
                    strokeWidth="14"
                    strokeDasharray={dasharray}
                    strokeDashoffset={dashoffset}
                    transform={`rotate(-90 ${size/2} ${size/2})`}
                    strokeLinecap="butt" />
          );
        })}
        <text x={size/2} y={size/2} dy="6" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="18" fontWeight="600" fill="var(--ink)">{total.toLocaleString("en-IN")}</text>
      </svg>
      <ul style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
        {data.map((d, i) => (
          <li key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color || "var(--brand-700)" }} />
            <span style={{ flex: 1 }}>{d.label}</span>
            <span className="mono" style={{ color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>{d.value.toLocaleString("en-IN")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ===========================================================
   Image uploaders — single primary + multi-image gallery
   Reads files via FileReader ↑ data URLs (mock storage).
   =========================================================== */
function ImagePicker({ value, onChange, label = "Cover image", aspect = "1 / 1", hint = "JPG, PNG or WebP · max 5 MB" }) {
  const inputRef = React.useRef(null);
  const [drag, setDrag] = React.useState(false);
  const readFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(file);
  };
  const onDrop = (e) => {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]);
  };
  return (
    <div className={"img-upload" + (drag ? " is-dragover" : "")}
         onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
         onDragLeave={() => setDrag(false)}
         onDrop={onDrop}>
      <div className="img-upload-thumb" style={{ aspectRatio: aspect, width: 96, height: aspect === "1 / 1" ? 96 : "auto" }}>
        {value
          ? <img src={value} alt="" />
          : <Icons.Package size={28} stroke={1.4} />}
      </div>
      <div className="img-upload-body">
        <div className="img-upload-title">{label}</div>
        <div className="img-upload-sub">{value ? "Drop a new image to replace, or pick from disk." : "Drag & drop, paste a URL, or pick from disk. " + hint}</div>
        <div className="img-upload-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => inputRef.current && inputRef.current.click()}>
            <Icons.Plus size={13} stroke={2} /> {value ? "Replace" : "Upload"}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => {
            const url = window.prompt("Image URL", typeof value === "string" && value.startsWith("http") ? value : "");
            if (url) onChange(url);
          }}>
            <Icons.ExtLink size={13} stroke={2} /> From URL
          </button>
          {value && (
            <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--rose)" }} onClick={() => onChange(null)}>
              <Icons.X size={13} stroke={2} /> Remove
            </button>
          )}
        </div>
        {value && typeof value === "string" && value.startsWith("http") && (
          <div className="img-upload-url">{value}</div>
        )}
        <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }}
               onChange={(e) => readFile(e.target.files[0])} />
      </div>
    </div>
  );
}

function ImageGallery({ images = [], onChange, max = 8 }) {
  const inputRef = React.useRef(null);
  const readFiles = (files) => {
    const arr = Array.from(files).slice(0, max - images.length);
    Promise.all(arr.map((f) => new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(f);
    }))).then((dataUrls) => onChange([...images, ...dataUrls]));
  };
  const removeAt = (i) => onChange(images.filter((_, idx) => idx !== i));
  const tiles = Array.from({ length: max }).map((_, i) => images[i]);
  return (
    <div className="gallery-grid">
      {tiles.map((src, i) => (
        <div key={i} className="gallery-tile">
          {src ? (
            <>
              <img src={src} alt="" />
              <button type="button" className="gallery-tile-remove" aria-label="Remove" onClick={() => removeAt(i)}>
                <Icons.X size={12} stroke={2.4} />
              </button>
            </>
          ) : (
            <div className="gallery-tile-empty" onClick={() => inputRef.current && inputRef.current.click()}>
              <Icons.Plus size={20} stroke={1.6} />
              <span>{i === 0 ? "Add" : ""}</span>
            </div>
          )}
        </div>
      ))}
      <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }}
             onChange={(e) => readFiles(e.target.files)} />
    </div>
  );
}

if (typeof window !== "undefined") Object.assign(window, {
  PortalShell, PortalSidebar, PortalHeader,
  KpiCard, Panel, FilterBar, EmptyPanel, StatusPill,
  Sparkline, BarRow, LineChart, DonutChart,
  ImagePicker, ImageGallery,
  PORTAL_CONFIG,
});

/* ============== user-pages.jsx ============== */
/* ===========================================================
   USER DASHBOARD — 8 pages
   =========================================================== */
const { useState: uUS, useMemo: uUM } = React;

/* ---------- 1. Overview ---------- */
function UserDashboard() {
  const D = window.NETHRA_DATA;
  const kpi = D.kpi.user;
  const user = D.currentUser;
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Welcome back, {user.full_name.split(" ")[0]}.</h1>
          <p className="portal-page-desc">Here's a snapshot of your orders, enquiries and saved products.</p>
        </div>
        <div className="portal-page-actions">
          <a href="/products" className="btn btn-primary"><Icons.Plus size={14} stroke={2} /> New order</a>
          <a href="/cart" className="btn btn-outline">View cart <Icons.ArrowR size={13} stroke={2} /></a>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard label="Total orders"      value={kpi.total_orders.toLocaleString("en-IN")}        icon="Package" delta={12} kicker="last 30 days" />
        <KpiCard label="Total spent"       value={"₹" + kpi.total_spent.toLocaleString("en-IN")}   icon="BadgeCheck" delta={8} kicker="all time" />
        <KpiCard label="Active enquiries"  value={kpi.active_enquiries}                            icon="Help" />
        <KpiCard label="Saved products"    value={kpi.saved_products}                              icon="Heart" />
      </div>

      <div className="quick-actions">
        <a className="quick-action" href="/cart"><Icons.Plus size={14} /> New enquiry</a>
        <a className="quick-action" href="/products"><Icons.Grid size={14} /> Browse products</a>
        <a className="quick-action" href="/my-orders"><Icons.Package size={14} /> My orders</a>
        <a className="quick-action" href="/my-enquiries"><Icons.Help size={14} /> My enquiries</a>
        <a className="quick-action" href="/track-order"><Icons.Truck size={14} /> Track</a>
      </div>

      <div className="portal-two-col">
        <Panel title="Recent orders" sub="Last 5 orders" action={<a href="/my-orders" className="btn btn-outline btn-sm">View all <Icons.ArrowR size={12} stroke={2} /></a>}>
          <div className="dtable-wrap">
            <table className="dtable">
              <thead><tr><th>Order #</th><th>Date</th><th>Items</th><th>Status</th><th className="num">Total</th><th></th></tr></thead>
              <tbody>
                {D.userOrders.slice(0, 5).map((o) => (
                  <tr key={o.id} className="is-clickable" onClick={() => window.location.href = "/order-detail?id=" + o.id}>
                    <td><span className="mono">{o.id}</span></td>
                    <td>{o.placed_at}</td>
                    <td>{o.items.length}</td>
                    <td><StatusPill status={o.status} /></td>
                    <td className="num">₹{o.total.toLocaleString("en-IN")}</td>
                    <td><a className="icon-btn" href={"order-detail.html?id=" + o.id} aria-label="View"><Icons.ArrowR size={14} /></a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Recent enquiries" sub="Last 5" action={<a href="/my-enquiries" className="btn btn-outline btn-sm">View all <Icons.ArrowR size={12} stroke={2} /></a>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {D.enquiries.slice(0, 4).map((e) => (
              <a key={e.id} href={"my-enquiries.html?id=" + e.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px dashed var(--line)" }}>
                <div>
                  <div className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>{e.id}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 2 }}>{e.items.length} items · est. ₹{e.total.toLocaleString("en-IN")}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{e.placed_at}</div>
                </div>
                <StatusPill status={e.status} />
              </a>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

/* ---------- 2. Profile ---------- */
function UserProfile() {
  const user = window.NETHRA_DATA.currentUser;
  const [form, setForm] = uUS({ full_name: user.full_name, email: user.email, phone: user.phone, language: user.language });
  const [dirty, setDirty] = uUS(false);
  const update = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setDirty(true); };
  const save = (e) => { e.preventDefault(); setDirty(false); window.toast && window.toast("Profile saved"); };
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">My profile</h1>
          <p className="portal-page-desc">Keep your contact details up to date. Your phone number is locked once verified.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 18 }}>
        <aside className="ident-card">
          <div className="ident-card-avatar">{user.avatar_initials}</div>
          <div className="ident-card-name">{user.full_name}</div>
          <div className="ident-card-email">{user.email}</div>
          <div style={{ marginTop: 12, display: "flex", justifyContent: "center", gap: 6 }}>
            <span className="pill pill-brand">{user.role.toUpperCase()}</span>
            <span className="pill pill-emerald">VERIFIED</span>
          </div>
          <div className="ident-card-rows">
            <div className="ident-card-row"><span className="ident-card-row-k">Phone</span><span className="ident-card-row-v mono">{user.phone}</span></div>
            <div className="ident-card-row"><span className="ident-card-row-k">Member since</span><span className="ident-card-row-v">{user.created_at}</span></div>
            <div className="ident-card-row"><span className="ident-card-row-k">Language</span><span className="ident-card-row-v">English</span></div>
          </div>
        </aside>

        <Panel title="Edit profile" sub="Update your personal information">
          <form className="form-rows" onSubmit={save}>
            <div className="auth-form-grid">
              <div className="field">
                <label className="field-label">Full name</label>
                <input className="input" value={form.full_name} onChange={(e) => update("full_name", e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label">Email</label>
                <input className="input" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
              </div>
            </div>
            <div className="auth-form-grid">
              <div className="field">
                <label className="field-label">Phone</label>
                <input className="input" value={form.phone} disabled style={{ background: "var(--paper-3)" }} />
                <div className="field-hint"><Icons.ShieldCheck size={11} stroke={1.8} style={{ verticalAlign: "-2px" }} /> Verified — cannot be changed</div>
              </div>
              <div className="field">
                <label className="field-label">Language</label>
                <select className="input" value={form.language} onChange={(e) => update("language", e.target.value)}>
                  <option value="en">English</option><option value="hi">à¤¹à¤¿à¤¨à¥à¤¦à¥€ (Hindi)</option><option value="ta">à®¤à®®à®¿à®´à¯ (Tamil)</option>
                  <option value="te">à°¤à±†à°²à±à°—à± (Telugu)</option><option value="kn">à²•à²¨à³à²¨à²¡ (Kannada)</option><option value="ml">à´®à´²à´¯à´¾à´³à´‚ (Malayalam)</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid var(--line)" }}>
              <span style={{ fontSize: 12.5, color: dirty ? "var(--amber)" : "var(--ink-3)" }}>
                {dirty ? "You have unsaved changes" : "All changes saved"}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => { setForm({ full_name: user.full_name, email: user.email, phone: user.phone, language: user.language }); setDirty(false); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!dirty}>Save changes</button>
              </div>
            </div>
          </form>
        </Panel>
      </div>
    </>
  );
}

/* ---------- 3. Addresses ---------- */
function UserAddresses() {
  const [addrs, setAddrs] = uUS(window.NETHRA_DATA.addresses);
  const [editing, setEditing] = uUS(null);
  const setDefault = (id) => setAddrs((arr) => arr.map((a) => ({ ...a, default: a.id === id })));
  const remove = (id) => setAddrs((arr) => arr.filter((a) => a.id !== id));
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Saved addresses</h1>
          <p className="portal-page-desc">Manage your delivery and billing addresses across orders.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({ id: null })}><Icons.Plus size={14} stroke={2} /> Add new address</button>
      </div>

      {addrs.length === 0 ? (
        <EmptyPanel icon="Pin" title="No addresses yet" desc="Add an address to checkout faster on your next order." actions={<button className="btn btn-primary" onClick={() => setEditing({ id: null })}>Add address</button>} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {addrs.map((a) => (
            <div key={a.id} className="panel">
              <div className="panel-body">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="pill pill-brand">{a.label}</span>
                    {a.default && <span className="pill pill-emerald">DEFAULT</span>}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="icon-btn" aria-label="Edit" onClick={() => setEditing(a)}><Icons.Edit size={14} /></button>
                    <button className="icon-btn" aria-label="Delete" onClick={() => remove(a.id)}><Icons.X size={14} /></button>
                  </div>
                </div>
                <div style={{ fontSize: 14.5, fontWeight: 500 }}>{a.label}</div>
                <div style={{ fontSize: 13.5, color: "var(--ink-2)", marginTop: 6, lineHeight: 1.5 }}>
                  {a.line1}, {a.line2}<br />
                  {a.city} {a.pin}, {a.state}<br />
                  <span className="mono" style={{ fontSize: 12.5 }}>{a.phone}</span>
                </div>
                {!a.default && (
                  <button className="btn btn-outline btn-sm" style={{ marginTop: 14 }} onClick={() => setDefault(a.id)}>Set as default</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 580 }}>
            <button className="icon-btn modal-close" onClick={() => setEditing(null)} aria-label="Close"><Icons.X size={16} /></button>
            <h3 style={{ fontSize: 20, marginBottom: 16 }}>{editing.id ? "Edit address" : "Add new address"}</h3>
            <form className="form-rows" onSubmit={(e) => { e.preventDefault(); setEditing(null); window.toast && window.toast("Address saved"); }}>
              <div className="auth-form-grid">
                <div className="field"><label className="field-label">Label</label>
                  <select className="input" defaultValue={editing.label || "Pharmacy"}>
                    <option>Home</option><option>Office</option><option>Pharmacy</option><option>Warehouse</option><option>Other</option>
                  </select>
                </div>
                <div className="field"><label className="field-label">Phone</label><input className="input" type="tel" defaultValue={editing.phone || ""} /></div>
              </div>
              <div className="field"><label className="field-label">Address line 1</label><input className="input" defaultValue={editing.line1 || ""} /></div>
              <div className="field"><label className="field-label">Address line 2</label><input className="input" defaultValue={editing.line2 || ""} /></div>
              <div className="auth-form-grid">
                <div className="field"><label className="field-label">City</label><input className="input" defaultValue={editing.city || ""} /></div>
                <div className="field"><label className="field-label">PIN code</label><input className="input" defaultValue={editing.pin || ""} /></div>
              </div>
              <div className="field"><label className="field-label">State</label><input className="input" defaultValue={editing.state || ""} /></div>
              <label className="terms-check"><input type="checkbox" defaultChecked={editing.default} /><span className="filter-check-box"><Icons.Check size={10} stroke={3} /></span><span>Set as default address</span></label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save address</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- 4. Orders list ---------- */
function UserOrdersList() {
  const D = window.NETHRA_DATA;
  const [status, setStatus] = uUS("all");
  const [q, setQ] = uUS("");
  const filtered = D.userOrders.filter((o) => {
    if (status !== "all" && o.status !== status) return false;
    if (q && !o.id.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">My orders</h1>
          <p className="portal-page-desc">All your orders across cycles, with tracking and invoices.</p>
        </div>
      </div>

      <Panel>
        <FilterBar>
          <div className="filter-bar-search">
            <Icons.Search size={14} stroke={1.7} className="filter-bar-search-ic" />
            <input className="input" placeholder="Search by order #" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="select sort-select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ height: 38 }}>
            <option value="all">All statuses</option>
            <option value="placed">Placed</option><option value="confirmed">Confirmed</option>
            <option value="dispatched">Dispatched</option><option value="out_for_delivery">Out for delivery</option>
            <option value="delivered">Delivered</option><option value="cancelled">Cancelled</option>
          </select>
          <div className="filter-bar-spacer" />
          <button className="btn btn-outline btn-sm"><Icons.Download size={13} stroke={2} /> Export</button>
        </FilterBar>
      </Panel>

      <Panel>
        {filtered.length === 0 ? (
          <EmptyPanel title="No orders found" desc="Try clearing filters or browse the catalog to place a new order." actions={<a className="btn btn-primary" href="/products">Browse catalog</a>} />
        ) : (
          <div className="dtable-wrap">
            <table className="dtable">
              <thead><tr><th>Order #</th><th>Date</th><th>Items</th><th className="num">Total</th><th>Status</th><th>Payment</th><th></th></tr></thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="is-clickable" onClick={() => window.location.href = "/order-detail?id=" + o.id}>
                    <td><span className="mono" style={{ fontWeight: 500 }}>{o.id}</span></td>
                    <td>{o.placed_at}</td>
                    <td>{o.items.length}</td>
                    <td className="num">₹{o.total.toLocaleString("en-IN")}</td>
                    <td><StatusPill status={o.status} /></td>
                    <td style={{ fontSize: 12, color: "var(--ink-3)" }}>{o.payment_method}</td>
                    <td className="actions">
                      <a className="icon-btn" href={"order-detail.html?id=" + o.id} aria-label="View"><Icons.ArrowR size={14} /></a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

/* ---------- 5. Order Detail ---------- */
function UserOrderDetail() {
  const id = window.getQuery("id");
  const order = window.NETHRA_DATA.userOrders.find((o) => o.id === id) || window.NETHRA_DATA.userOrders[0];
  const [tab, setTab] = uUS("items");
  const itemsResolved = order.items.map((it) => ({ ...it, p: window.findProduct(it.product_id) })).filter((x) => x.p);
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Order {order.id}</h1>
          <p className="portal-page-desc">Placed on {order.placed_at} · {order.items.length} items · ₹{order.total.toLocaleString("en-IN")}</p>
        </div>
        <div className="portal-page-actions">
          <StatusPill status={order.status} />
          {order.status !== "cancelled" && order.status !== "delivered" && (
            <a className="btn btn-primary" href={"track-order.html?id=" + order.id}>Track <Icons.ArrowR size={13} stroke={2} /></a>
          )}
          {order.status === "delivered" && (
            <button className="btn btn-outline"><Icons.Plus size={13} stroke={2} /> Reorder</button>
          )}
        </div>
      </div>

      <div className="portal-two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Panel title="Items" sub={order.items.length + " line items"}>
            <div className="dtable-wrap">
              <table className="dtable">
                <thead><tr><th></th><th>Product</th><th>Qty</th><th className="num">Unit price</th><th className="num">Line total</th></tr></thead>
                <tbody>
                  {itemsResolved.map((it) => (
                    <tr key={it.product_id}>
                      <td style={{ width: 56 }}>
                        <div style={{ width: 44, height: 44 }}><ProductTile product={it.p} size="sm" /></div>
                      </td>
                      <td>
                        <div className="tcell-name"><div>
                          <strong>{it.p.name}</strong>
                          <small>{it.p.brand} · {it.p.unit_label}</small>
                        </div></div>
                      </td>
                      <td>{it.qty}</td>
                      <td className="num">₹{it.p.price_min.toLocaleString("en-IN")}</td>
                      <td className="num">₹{(it.p.price_min * it.qty).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Status timeline">
            <div className="confirm-timeline">
              {(order.timeline || [
                { label: "Order placed",        ts: order.placed_at,  done: true },
                { label: "Packed at warehouse", ts: "+2h",            done: true },
                { label: "Shipped",              ts: "+8h",            done: order.status !== "placed" && order.status !== "confirmed" },
                { label: "Out for delivery",     ts: "—",              done: order.status === "out_for_delivery" || order.status === "delivered" },
                { label: "Delivered",            ts: order.eta,        done: order.status === "delivered" },
              ]).map((t, i, arr) => (
                <div key={i} className="confirm-tl-row">
                  <div className="confirm-tl-marker">
                    <div className={"confirm-tl-dot" + (t.done ? " is-done" : "")} />
                    {i < arr.length - 1 && <div className="confirm-tl-line" />}
                  </div>
                  <div className="confirm-tl-body">
                    <div className="confirm-tl-label">{t.label}</div>
                    <div className="confirm-tl-meta">{t.ts}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Panel title="Order summary">
            <div className="cart-summary-row"><span>Subtotal</span><span className="mono">₹{order.subtotal.toLocaleString("en-IN")}</span></div>
            <div className="cart-summary-row"><span>GST</span><span className="mono">₹{order.tax.toLocaleString("en-IN")}</span></div>
            <div className="cart-summary-row"><span>Shipping</span><span className="mono">{order.shipping === 0 ? "FREE" : "₹" + order.shipping}</span></div>
            <div className="cart-summary-row total"><span>Total</span><span className="mono">₹{order.total.toLocaleString("en-IN")}</span></div>
          </Panel>
          <Panel title="Ship to">
            <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>
              <strong>{order.address.label}</strong><br />
              {order.address.line1}, {order.address.line2}<br />
              {order.address.city} {order.address.pin}<br />
              <span className="mono" style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{order.address.phone}</span>
            </div>
          </Panel>
          <Panel title="Payment">
            <div style={{ fontSize: 13.5 }}>{order.payment_method}</div>
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button className="btn btn-outline btn-sm"><Icons.Download size={13} stroke={2} /> Invoice</button>
              <button className="btn btn-outline btn-sm"><Icons.Mail size={13} stroke={2} /> Email</button>
            </div>
          </Panel>
          {order.status === "delivered" && (
            <Panel title="Need help?">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button className="btn btn-outline btn-sm" style={{ justifyContent: "flex-start" }}><Icons.Package size={13} stroke={2} /> Return items</button>
                <button className="btn btn-outline btn-sm" style={{ justifyContent: "flex-start" }}><Icons.Help size={13} stroke={2} /> Contact support</button>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

/* ---------- 6. Enquiries ---------- */
function UserEnquiries() {
  const D = window.NETHRA_DATA;
  const [status, setStatus] = uUS("all");
  const filtered = D.enquiries.filter((e) => status === "all" ? true : e.status === status);
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">My enquiries</h1>
          <p className="portal-page-desc">Request quotes from sales reps before checkout — especially for bulk PO orders.</p>
        </div>
        <button className="btn btn-primary"><Icons.Plus size={14} stroke={2} /> New enquiry</button>
      </div>

      <Panel>
        <FilterBar>
          <select className="select sort-select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ height: 38 }}>
            <option value="all">All statuses</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="rejected">Rejected</option><option value="checked_out">Checked out</option>
          </select>
        </FilterBar>
      </Panel>

      <Panel>
        {filtered.length === 0 ? (
          <EmptyPanel title="No enquiries" desc="Open a new enquiry to request a quote from your sales rep." />
        ) : (
          <div className="dtable-wrap">
            <table className="dtable">
              <thead><tr><th>Enquiry #</th><th>Date</th><th>Items</th><th className="num">Est. total</th><th>Sales rep</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <td><span className="mono" style={{ fontWeight: 500 }}>{e.id}</span></td>
                    <td>{e.placed_at}</td>
                    <td>{e.items.length}</td>
                    <td className="num">₹{e.total.toLocaleString("en-IN")}</td>
                    <td style={{ fontSize: 12.5 }}>{e.sales_rep}</td>
                    <td><StatusPill status={e.status} /></td>
                    <td className="actions">
                      {e.status === "confirmed" && <a href="/checkout" className="btn btn-primary btn-sm">Checkout</a>}
                      <button className="icon-btn" aria-label="View"><Icons.ArrowR size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

/* ---------- 7. Wishlist ---------- */
function UserWishlist() {
  const D = window.NETHRA_DATA;
  // Use a curated subset as wishlist
  const wishlist = [D.products[3], D.products[6], D.products[9], D.products[1], D.products[5], D.products[8]];
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Saved products</h1>
          <p className="portal-page-desc">{wishlist.length} items saved · easily reorder favourites or move to cart.</p>
        </div>
        <a className="btn btn-outline" href="/products">Browse products <Icons.ArrowR size={13} stroke={2} /></a>
      </div>

      <div className="prod-grid cols-4">
        {wishlist.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </>
  );
}

/* ---------- 8. Notifications ---------- */
function UserNotifications() {
  const D = window.NETHRA_DATA;
  const [filter, setFilter] = uUS("all");
  const [items, setItems] = uUS(D.notifications);
  const filtered = items.filter((n) => filter === "all" ? true : filter === "unread" ? !n.read : n.type === filter);
  const markRead = (id) => setItems((arr) => arr.map((n) => n.id === id ? { ...n, read: true } : n));
  const markAll = () => setItems((arr) => arr.map((n) => ({ ...n, read: true })));
  const typeIcon = { order: "Package", enquiry: "Help", system: "Sparkle", alert: "ShieldCheck", verification: "BadgeCheck", report: "Calendar", message: "Mail" };
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Notifications</h1>
          <p className="portal-page-desc">{items.filter((n) => !n.read).length} unread · auto-archived after 60 days.</p>
        </div>
        <button className="btn btn-outline" onClick={markAll}><Icons.Check size={13} stroke={2} /> Mark all read</button>
      </div>

      <Panel>
        <FilterBar>
          {[["all","All"],["unread","Unread"],["order","Orders"],["enquiry","Enquiries"],["alert","Alerts"],["system","System"]].map(([k, l]) => (
            <button key={k} className={"filter-radio" + (filter === k ? " is-active" : "")} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </FilterBar>
      </Panel>

      <Panel>
        {filtered.length === 0 ? (
          <EmptyPanel icon="Bell" title="You're all caught up" desc="No notifications match this filter." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {filtered.map((n) => {
              const Icon = Icons[typeIcon[n.type] || "Sparkle"];
              return (
                <a key={n.id} href={n.link} onClick={() => markRead(n.id)} style={{
                  display: "grid",
                  gridTemplateColumns: "44px 1fr auto",
                  gap: 14, padding: "14px 4px", borderBottom: "1px solid var(--line)",
                  background: n.read ? "transparent" : "var(--brand-50)",
                  borderRadius: 8,
                }}>
                  <div className="kpi-card-ic" style={{ alignSelf: "flex-start" }}><Icon size={16} stroke={1.7} /></div>
                  <div>
                    <div style={{ fontWeight: n.read ? 400 : 600, fontSize: 14 }}>{n.title}</div>
                    <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>{n.body}</div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", textAlign: "right", whiteSpace: "nowrap" }}>{n.created_at}</div>
                </a>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}

if (typeof window !== "undefined") Object.assign(window, {
  UserDashboard, UserProfile, UserAddresses,
  UserOrdersList, UserOrderDetail, UserEnquiries,
  UserWishlist, UserNotifications,
});

/* ============== sales-pages.jsx ============== */
/* ===========================================================
   SALES PORTAL — 5 pages
   =========================================================== */
const { useState: sUS, useMemo: sUM } = React;

/* ---------- 1. Sales Dashboard ---------- */
function SalesDashboard() {
  const D = window.NETHRA_DATA;
  const k = D.kpi.sales;
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Sales overview</h1>
          <p className="portal-page-desc">Live performance across your customer book and the team's pipeline.</p>
        </div>
        <div className="portal-page-actions">
          <a href="/sales-reports" className="btn btn-outline">Reports <Icons.ArrowR size={13} stroke={2} /></a>
          <a href="/verifications" className="btn btn-primary">Verifications · 3 pending <Icons.ArrowR size={13} stroke={2} /></a>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard label="Revenue · 30d"  value={"₹" + (k.revenue_30d / 100000).toFixed(1) + "L"} icon="Award" delta={14} kicker="vs last 30d" />
        <KpiCard label="Orders · 30d"   value={k.orders_30d.toLocaleString("en-IN")} icon="Package" delta={9} kicker="vs last 30d" />
        <KpiCard label="Active customers" value={k.active_customers} icon="Users" delta={4} kicker="MoM" />
        <KpiCard label="Conversion"      value={k.conv_rate + "%"} icon="BadgeCheck" delta={2.1} kicker="MoM" />
        <KpiCard label="Pending verifications" value={k.pending_verifications} icon="ShieldCheck" />
        <KpiCard label="Team performance" value={k.team_index.toFixed(2) + "x"} icon="Sparkle" delta={6} kicker="vs target" />
      </div>

      <div className="portal-two-col">
        <Panel title="Revenue trend" sub="Last 30 days · daily">
          <LineChart data={D.revenueTrend} height={220} />
        </Panel>
        <Panel title="Pending verifications" sub="Latest 5"
          action={<a href="/verifications" className="btn btn-outline btn-sm">View all <Icons.ArrowR size={12} stroke={2} /></a>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {D.verificationRequests.filter((v) => v.status === "pending").slice(0, 5).map((v) => (
              <div key={v.id} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px dashed var(--line)" }}>
                <div className="dtable-avatar">{v.customer.split(" ").slice(0,2).map((x) => x[0]).join("").toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{v.customer}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{v.doc_type}</div>
                </div>
                <a href={"verifications.html?id=" + v.id} className="btn btn-outline btn-sm">Review</a>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Recent orders" sub="Last 5 in your book"
        action={<a href="/sales-orders" className="btn btn-outline btn-sm">View all <Icons.ArrowR size={12} stroke={2} /></a>}>
        <div className="dtable-wrap">
          <table className="dtable">
            <thead><tr><th>Order #</th><th>Customer</th><th>Date</th><th>Items</th><th className="num">Total</th><th>Status</th></tr></thead>
            <tbody>
              {D.adminOrders.slice(0, 5).map((o) => (
                <tr key={o.id}>
                  <td><span className="mono">{o.id}</span></td>
                  <td>{o.customer.name}</td>
                  <td>{o.placed_at}</td>
                  <td>{o.items.length}</td>
                  <td className="num">₹{o.total.toLocaleString("en-IN")}</td>
                  <td><StatusPill status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

/* ---------- 2. Customers ---------- */
function SalesCustomers() {
  const D = window.NETHRA_DATA;
  const [q, setQ] = sUS("");
  const [role, setRole] = sUS("all");
  const [status, setStatus] = sUS("all");
  const filtered = D.customers.filter((c) => {
    if (q && !(c.name + c.phone + c.email).toLowerCase().includes(q.toLowerCase())) return false;
    if (role !== "all" && c.role !== role) return false;
    if (status !== "all" && c.status !== status) return false;
    return true;
  });
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Customers</h1>
          <p className="portal-page-desc">{D.customers.length.toLocaleString("en-IN")} total · search, segment, and manage your book.</p>
        </div>
        <div className="portal-page-actions">
          <button className="btn btn-outline btn-sm"><Icons.Download size={13} stroke={2} /> Export</button>
          <button className="btn btn-primary btn-sm"><Icons.Plus size={13} stroke={2} /> Add customer</button>
        </div>
      </div>

      <Panel>
        <FilterBar>
          <div className="filter-bar-search">
            <Icons.Search size={14} stroke={1.7} className="filter-bar-search-ic" />
            <input className="input" placeholder="Search name, phone, email…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="sort-select" value={role} onChange={(e) => setRole(e.target.value)} style={{ height: 38 }}>
            <option value="all">All roles</option><option value="customer">Customer</option><option value="clinician">Clinician</option><option value="retailer">Retailer</option>
          </select>
          <select className="sort-select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ height: 38 }}>
            <option value="all">All statuses</option><option value="active">Active</option><option value="pending">Pending</option><option value="suspended">Suspended</option>
          </select>
          <div className="filter-bar-spacer" />
          <span className="kicker">{filtered.length} of {D.customers.length}</span>
        </FilterBar>
      </Panel>

      <Panel>
        <div className="dtable-wrap">
          <table className="dtable">
            <thead><tr>
              <th>Customer</th><th>Role</th><th>Verified</th><th>Reg date</th>
              <th>Last order</th><th className="num">Orders</th><th className="num">Spent</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="tcell-name">
                      <div className="dtable-avatar">{c.name.split(" ").slice(0,2).map((x) => x[0]).join("").toUpperCase()}</div>
                      <div>
                        <strong>{c.name}</strong>
                        <small className="mono">{c.id} · {c.phone}</small>
                      </div>
                    </div>
                  </td>
                  <td><span className="pill pill-brand">{c.role.toUpperCase()}</span></td>
                  <td>{c.verified ? <Icons.BadgeCheck size={16} stroke={1.8} style={{ color: "var(--emerald)" }} /> : <Icons.X size={14} style={{ color: "var(--ink-3)" }} />}</td>
                  <td>{c.reg}</td>
                  <td style={{ fontSize: 12.5 }}>{c.last_order || "—"}</td>
                  <td className="num">{c.orders}</td>
                  <td className="num">₹{c.spent.toLocaleString("en-IN")}</td>
                  <td><StatusPill status={c.status} /></td>
                  <td className="actions">
                    <button className="icon-btn" aria-label="View"><Icons.ArrowR size={14} /></button>
                    <button className="icon-btn" aria-label="Message"><Icons.Mail size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

/* ---------- 3. Sales Orders (shared, role-aware) ---------- */
function SalesOrders({ portal = "sales" }) {
  const D = window.NETHRA_DATA;
  const [status, setStatus] = sUS("all");
  const [q, setQ] = sUS("");
  const filtered = D.adminOrders.filter((o) => {
    if (status !== "all" && o.status !== status) return false;
    if (q && !(o.id + " " + o.customer.name).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Orders</h1>
          <p className="portal-page-desc">{filtered.length.toLocaleString("en-IN")} orders matching your filter.</p>
        </div>
        <div className="portal-page-actions">
          <button className="btn btn-outline btn-sm"><Icons.Download size={13} stroke={2} /> Export CSV</button>
        </div>
      </div>

      <Panel>
        <FilterBar>
          <div className="filter-bar-search">
            <Icons.Search size={14} stroke={1.7} className="filter-bar-search-ic" />
            <input className="input" placeholder="Search by order # or customer" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="sort-select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ height: 38 }}>
            <option value="all">All statuses</option>
            <option value="placed">Placed</option><option value="confirmed">Confirmed</option>
            <option value="dispatched">Dispatched</option><option value="out_for_delivery">Out for delivery</option>
            <option value="delivered">Delivered</option><option value="cancelled">Cancelled</option>
          </select>
        </FilterBar>
      </Panel>

      <Panel>
        <div className="dtable-wrap">
          <table className="dtable">
            <thead><tr>
              <th>Order #</th><th>Customer</th><th>Date</th><th>Items</th>
              <th className="num">Total</th><th>Payment</th>
              {(portal === "manager" || portal === "admin") && <th>Sales rep</th>}
              <th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id}>
                  <td><span className="mono">{o.id}</span></td>
                  <td>{o.customer.name}</td>
                  <td>{o.placed_at}</td>
                  <td>{o.items.length}</td>
                  <td className="num">₹{o.total.toLocaleString("en-IN")}</td>
                  <td><span className="pill pill-outline" style={{ fontSize: 9.5 }}>{o.payment_status?.toUpperCase()}</span></td>
                  {(portal === "manager" || portal === "admin") && <td style={{ fontSize: 12 }}>{o.sales_rep}</td>}
                  <td><StatusPill status={o.status} /></td>
                  <td className="actions">
                    <button className="icon-btn" aria-label="View"><Icons.ArrowR size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

/* ---------- 4. Sales Enquiries ---------- */
function SalesEnquiriesList({ portal = "sales" }) {
  const D = window.NETHRA_DATA;
  const [tab, setTab] = sUS("all");
  const filtered = D.enquiries.filter((e) => tab === "all" ? true : e.status === tab);
  const counts = {
    all: D.enquiries.length,
    pending: D.enquiries.filter((e) => e.status === "pending").length,
    confirmed: D.enquiries.filter((e) => e.status === "confirmed").length,
    rejected: D.enquiries.filter((e) => e.status === "rejected").length,
  };
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Enquiries</h1>
          <p className="portal-page-desc">Customer quote requests awaiting your response.</p>
        </div>
      </div>

      <div className="tab-row">
        {[["all","All"],["pending","Pending"],["confirmed","Confirmed"],["rejected","Rejected"],["checked_out","Checked out"]].map(([k, l]) => (
          <button key={k} className={"tab-row-item" + (tab === k ? " is-active" : "")} onClick={() => setTab(k)}>
            {l} {counts[k] != null && <span style={{ color: "var(--ink-3)", marginLeft: 4 }}>{counts[k]}</span>}
          </button>
        ))}
      </div>

      <Panel>
        <div className="dtable-wrap">
          <table className="dtable">
            <thead><tr>
              <th>Enquiry #</th><th>Customer</th><th>Date</th><th>Items</th>
              <th className="num">Est. total</th>{(portal === "manager" || portal === "admin") && <th>Sales rep</th>}<th>Days pending</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td><span className="mono">{e.id}</span></td>
                  <td>{e.customer.name}</td>
                  <td>{e.placed_at}</td>
                  <td>{e.items.length}</td>
                  <td className="num">₹{e.total.toLocaleString("en-IN")}</td>
                  {(portal === "manager" || portal === "admin") && <td style={{ fontSize: 12 }}>{e.sales_rep}</td>}
                  <td>{e.days_pending}</td>
                  <td><StatusPill status={e.status} /></td>
                  <td className="actions">
                    {e.status === "pending" && <button className="btn btn-primary btn-sm">Send quote</button>}
                    <button className="icon-btn" aria-label="View"><Icons.ArrowR size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

/* ---------- 5. Verifications ---------- */
function SalesVerifications() {
  const D = window.NETHRA_DATA;
  const [tab, setTab] = sUS("all");
  const filtered = D.verificationRequests.filter((v) => tab === "all" ? true : v.status === tab);
  const counts = {
    all: D.verificationRequests.length,
    pending: D.verificationRequests.filter((v) => v.status === "pending").length,
    approved: D.verificationRequests.filter((v) => v.status === "approved").length,
    rejected: D.verificationRequests.filter((v) => v.status === "rejected").length,
  };
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Verification requests</h1>
          <p className="portal-page-desc">Documents submitted by customers awaiting review.</p>
        </div>
        <div className="portal-page-actions">
          <button className="btn btn-outline btn-sm"><Icons.Check size={13} stroke={2} /> Bulk approve</button>
          <button className="btn btn-outline btn-sm"><Icons.X size={13} stroke={2} /> Bulk reject</button>
        </div>
      </div>

      <div className="tab-row">
        {[["all","All"],["pending","Pending"],["approved","Approved"],["rejected","Rejected"]].map(([k, l]) => (
          <button key={k} className={"tab-row-item" + (tab === k ? " is-active" : "")} onClick={() => setTab(k)}>
            {l} {counts[k] != null && <span style={{ color: "var(--ink-3)", marginLeft: 4 }}>{counts[k]}</span>}
          </button>
        ))}
      </div>

      <Panel>
        <div className="dtable-wrap">
          <table className="dtable">
            <thead><tr>
              <th><input type="checkbox" /></th>
              <th>Request #</th><th>Customer</th><th>Document type</th><th>Submitted</th>
              <th>Expires</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id}>
                  <td><input type="checkbox" /></td>
                  <td><span className="mono">{v.id}</span></td>
                  <td>{v.customer}</td>
                  <td>
                    <div style={{ fontWeight: 500, fontSize: 13.5 }}>{v.doc_type}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-3)" }} className="mono">{v.credential}</div>
                  </td>
                  <td>{v.submitted}</td>
                  <td style={{ fontSize: 12 }}>{v.expires || "—"}</td>
                  <td><StatusPill status={v.status} /></td>
                  <td className="actions">
                    {v.status === "pending" && (
                      <>
                        <button className="btn btn-primary btn-sm" onClick={() => window.toast && window.toast("Approved " + v.id)}><Icons.Check size={12} stroke={2.4} /> Approve</button>
                        <button className="btn btn-outline btn-sm" onClick={() => window.toast && window.toast("Rejected " + v.id)}><Icons.X size={12} stroke={2.2} /></button>
                      </>
                    )}
                    {v.status !== "pending" && <button className="icon-btn" aria-label="View"><Icons.ArrowR size={14} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

/* ---------- Notifications (reused for sales/manager) ---------- */
function SalesNotifications() {
  return <UserNotifications />;
}

if (typeof window !== "undefined") Object.assign(window, {
  SalesDashboard, SalesCustomers, SalesOrders,
  SalesEnquiriesList, SalesVerifications, SalesNotifications,
});

/* ============== manager-pages.jsx ============== */
/* ===========================================================
   MANAGER PORTAL — 4 pages
   =========================================================== */
const { useState: mgUS } = React;

/* ---------- 1. Manager Dashboard ---------- */
function ManagerDashboard() {
  const D = window.NETHRA_DATA;
  const k = D.kpi.manager;
  const team = D.salesTeam.slice().sort((a,b) => b.revenue - a.revenue);
  const maxRev = Math.max(...team.map((t) => t.revenue));
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Manager overview</h1>
          <p className="portal-page-desc">Your team's pipeline, performance, and pending approvals — at a glance.</p>
        </div>
        <a href="/manager-analytics" className="btn btn-primary">Open analytics <Icons.ArrowR size={13} stroke={2} /></a>
      </div>

      <div className="kpi-grid">
        <KpiCard label="Team revenue · 30d" value={"₹" + (k.team_revenue / 100000).toFixed(1) + "L"} icon="Award" delta={18} kicker="MoM" />
        <KpiCard label="Team orders"        value={k.team_orders.toLocaleString("en-IN")} icon="Package" delta={11} kicker="MoM" />
        <KpiCard label="Team customers"     value={k.team_customers} icon="Users" delta={6} kicker="MoM" />
        <KpiCard label="Avg revenue / rep"  value={"₹" + (k.avg_rep / 100000).toFixed(1) + "L"} icon="BadgeCheck" delta={12} kicker="MoM" />
        <KpiCard label="Top performer"      value={k.top_rep.name.split(" ")[0]} icon="Sparkle" kicker={"₹" + (k.top_rep.revenue / 100000).toFixed(1) + "L"} />
        <KpiCard label="Conversion"         value={k.conv + "%"} icon="Help" delta={1.4} kicker="MoM" />
      </div>

      <div className="portal-two-col">
        <Panel title="Team performance" sub="Sorted by 30d revenue"
          action={<a href="/manager-team" className="btn btn-outline btn-sm">Detailed view <Icons.ArrowR size={12} stroke={2} /></a>}>
          {team.map((t) => (
            <BarRow key={t.id} name={t.name} value={t.revenue} max={maxRev} format={(v) => "₹" + (v/100000).toFixed(1) + "L"} />
          ))}
        </Panel>
        <Panel title="Revenue trend" sub="Last 30 days">
          <LineChart data={D.revenueTrend} height={220} />
        </Panel>
      </div>

      <div className="portal-two-col">
        <Panel title="Recent orders" action={<a href="/manager-orders" className="btn btn-outline btn-sm">All <Icons.ArrowR size={12} stroke={2} /></a>}>
          <div className="dtable-wrap">
            <table className="dtable">
              <thead><tr><th>Order #</th><th>Customer</th><th>Rep</th><th className="num">Total</th><th>Status</th></tr></thead>
              <tbody>
                {D.adminOrders.slice(0, 5).map((o) => (
                  <tr key={o.id}>
                    <td><span className="mono">{o.id}</span></td>
                    <td>{o.customer.name}</td>
                    <td style={{ fontSize: 12 }}>{o.sales_rep}</td>
                    <td className="num">₹{o.total.toLocaleString("en-IN")}</td>
                    <td><StatusPill status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Pending enquiries"
          action={<a href="/sales-enquiries" className="btn btn-outline btn-sm">All <Icons.ArrowR size={12} stroke={2} /></a>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {D.enquiries.filter((e) => e.status === "pending").map((e) => (
              <div key={e.id} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px dashed var(--line)" }}>
                <div style={{ flex: 1 }}>
                  <div className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>{e.id}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{e.customer.name} · {e.items.length} items</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>Rep: {e.sales_rep}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 500 }}>₹{e.total.toLocaleString("en-IN")}</div>
                  <div style={{ fontSize: 11, color: "var(--amber)", marginTop: 4 }}>{e.days_pending}d pending</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

/* ---------- 2. Analytics ---------- */
function ManagerAnalytics() {
  const D = window.NETHRA_DATA;
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Analytics</h1>
          <p className="portal-page-desc">Performance metrics across the team, customers, and product mix.</p>
        </div>
        <div className="portal-page-actions">
          <select className="sort-select" style={{ height: 38 }}>
            <option>Last 30 days</option><option>Last 90 days</option><option>This quarter</option><option>Year to date</option>
          </select>
          <button className="btn btn-outline btn-sm"><Icons.Download size={13} stroke={2} /> Export PDF</button>
        </div>
      </div>

      <Panel title="Revenue trend" sub="Daily · last 30 days">
        <LineChart data={D.revenueTrend} height={260} />
      </Panel>

      <div className="portal-two-col">
        <Panel title="Orders by status">
          <DonutChart data={[
            { label: "Delivered",        value: 218, color: "var(--chart-1)" },
            { label: "Dispatched",       value: 84,  color: "var(--chart-2)" },
            { label: "Out for delivery", value: 41,  color: "var(--chart-4)" },
            { label: "Cancelled",        value: 18,  color: "var(--rose)" },
            { label: "Pending",          value: 31,  color: "var(--chart-6)" },
          ]} />
        </Panel>
        <Panel title="Revenue by role">
          <DonutChart data={[
            { label: "Retailer",  value: 1248, color: "var(--chart-1)" },
            { label: "Clinician", value: 412,  color: "var(--chart-5)" },
            { label: "Customer",  value: 184,  color: "var(--chart-3)" },
          ]} />
        </Panel>
      </div>

      <Panel title="Top 10 products by revenue">
        {D.products.slice(0, 10).sort((a,b) => b.price_max*b.reviews - a.price_max*a.reviews).map((p, i) => (
          <BarRow key={p.id} name={p.name} value={p.price_max * (p.reviews || 1)} max={D.products[0].price_max * D.products[0].reviews}
            format={(v) => "₹" + (v / 100000).toFixed(1) + "L"} />
        ))}
      </Panel>
    </>
  );
}

/* ---------- 3. Manager Team ---------- */
function ManagerTeam() {
  const D = window.NETHRA_DATA;
  const team = D.salesTeam.slice().sort((a,b) => b.revenue - a.revenue);
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Team performance</h1>
          <p className="portal-page-desc">{team.length} active reps · sorted by revenue contribution.</p>
        </div>
        <button className="btn btn-outline btn-sm"><Icons.Download size={13} stroke={2} /> Export</button>
      </div>

      <Panel>
        <div className="dtable-wrap">
          <table className="dtable">
            <thead><tr>
              <th>Rank</th><th>Rep</th><th>Status</th><th className="num">Revenue</th><th className="num">Orders</th>
              <th className="num">Customers</th><th className="num">AOV</th><th className="num">Conv %</th><th></th>
            </tr></thead>
            <tbody>
              {team.map((t, i) => (
                <tr key={t.id}>
                  <td className="num"><strong>#{i + 1}</strong></td>
                  <td>
                    <div className="tcell-name">
                      <div className="dtable-avatar">{t.avatar}</div>
                      <div>
                        <strong>{t.name}</strong>
                        <small>{t.email} · <span className="mono">{t.phone}</span></small>
                      </div>
                    </div>
                  </td>
                  <td><StatusPill status={t.status} /></td>
                  <td className="num">₹{(t.revenue/100000).toFixed(1)}L</td>
                  <td className="num">{t.orders}</td>
                  <td className="num">{t.customers}</td>
                  <td className="num">₹{t.aov.toLocaleString("en-IN")}</td>
                  <td className="num">{t.conv}%</td>
                  <td className="actions">
                    <button className="icon-btn" aria-label="View"><Icons.ArrowR size={14} /></button>
                    <button className="icon-btn" aria-label="Message"><Icons.Mail size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Revenue by team member">
        {team.map((t) => (
          <BarRow key={t.id} name={t.name} value={t.revenue} max={team[0].revenue} format={(v) => "₹" + (v/100000).toFixed(1) + "L"} />
        ))}
      </Panel>
    </>
  );
}

/* ---------- 4. Manager Orders (reuses SalesOrders w/ rep col) ---------- */
function ManagerOrders() { return <SalesOrders portal="manager" />; }

if (typeof window !== "undefined") Object.assign(window, { ManagerDashboard, ManagerAnalytics, ManagerTeam, ManagerOrders });

/* ============== admin-pages.jsx ============== */
/* ===========================================================
   ADMIN PORTAL — 12 pages
   =========================================================== */
const { useState: adUS, useMemo: adUM } = React;

/* ---------- 1. Admin Dashboard ---------- */
function AdminDashboard() {
  const D = window.NETHRA_DATA;
  const k = D.kpi.admin;
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Admin overview</h1>
          <p className="portal-page-desc">Platform-wide health, revenue, and operational alerts.</p>
        </div>
        <div className="portal-page-actions">
          <a href="/admin-analytics" className="btn btn-outline">Analytics</a>
          <button className="btn btn-primary"><Icons.Download size={13} stroke={2} /> Download report</button>
        </div>
      </div>

      <div className="alert-banner is-brand">
        <div className="alert-banner-ic"><Icons.ShieldCheck size={16} stroke={1.8} /></div>
        <div className="alert-banner-body">
          <div className="alert-banner-title">All systems operational · uptime {k.uptime}%</div>
          <div className="alert-banner-sub">Last backup: today 02:00 IST · 4 hr fresh</div>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard label="Total users"      value={k.total_users.toLocaleString("en-IN")} icon="Users" delta={4.2} kicker="MoM" />
        <KpiCard label="Total revenue"    value={"₹" + (k.total_revenue / 10000000).toFixed(1) + "Cr"} icon="Award" delta={11.4} kicker="MoM" />
        <KpiCard label="Total orders"     value={k.total_orders.toLocaleString("en-IN")} icon="Package" delta={8.1} kicker="MoM" />
        <KpiCard label="Active orders"    value={k.active_orders} icon="Truck" />
        <KpiCard label="Pending enquiries" value={k.pending_enquiries} icon="Help" />
      </div>

      <Panel title="Revenue trend" sub="Last 30 days">
        <LineChart data={D.revenueTrend} height={240} />
      </Panel>

      <div className="quick-actions">
        <a className="quick-action" href="/admin-users"><Icons.Users size={14} /> View users</a>
        <a className="quick-action" href="/admin-orders"><Icons.Package size={14} /> View orders</a>
        <a className="quick-action" href="/admin-analytics"><Icons.Calendar size={14} /> Analytics</a>
        <a className="quick-action" href="/admin-settings"><Icons.Sparkle size={14} /> System health</a>
        <a className="quick-action" href="/admin-cms"><Icons.Building size={14} /> CMS</a>
      </div>

      <Panel title="Audit log" sub="Recent administrative actions" action={<a href="#" className="btn btn-outline btn-sm">Full log</a>}>
        <div className="dtable-wrap">
          <table className="dtable">
            <thead><tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Target</th><th>IP</th></tr></thead>
            <tbody>
              {D.auditLog.slice(0, 6).map((a, i) => (
                <tr key={i}>
                  <td className="mono" style={{ fontSize: 12 }}>{a.ts}</td>
                  <td>{a.actor}</td>
                  <td><span className="pill pill-outline" style={{ fontSize: 9.5 }}>{a.action.toUpperCase()}</span></td>
                  <td style={{ fontSize: 12.5 }}>{a.target}</td>
                  <td className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>{a.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

/* ---------- 2. Admin Users (CRUD) ---------- */
const USER_ROLES = [
  { k: "admin",     label: "Admin",     desc: "Full platform access · careful with this one.", icon: "ShieldCheck", color: "var(--rose)" },
  { k: "manager",   label: "Manager",   desc: "Sales lead · team analytics, overrides, reports.", icon: "Award", color: "var(--brand-700)" },
  { k: "sales",     label: "Sales",     desc: "Manages customers, enquiries, verifications.", icon: "Users", color: "var(--brand-500)" },
  { k: "hr",        label: "HR",        desc: "Employees, leave, payroll, holidays.", icon: "BadgeCheck", color: "var(--clay)" },
  { k: "clinician", label: "Clinician", desc: "External · doctor with institutional pricing.", icon: "Stethoscope", color: "var(--blue)" },
  { k: "retailer",  label: "Retailer",  desc: "External · pharmacy with wholesale margin.", icon: "Building", color: "var(--copper)" },
  { k: "customer",  label: "Customer",  desc: "External · consumer-pricing buyer.", icon: "User", color: "var(--ink-3)" },
];

function genPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$";
  let out = ""; for (let i = 0; i < 14; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
function initialsFor(name) {
  return (name || "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
}

function UserFormModal({ user, onClose, onSave, defaultRole }) {
  const isEdit = !!user;
  const initial = user || {
    name: "", email: "", phone: "+91 ",
    role: defaultRole || "sales",
    status: "active",
    send_invite: true,
    department: "",
    password: genPassword(),
    avatar: "",
  };
  const [f, setF] = adUS(initial);
  const [showPw, setShowPw] = adUS(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const submit = (e) => {
    e.preventDefault();
    if (!f.name || !f.email) { window.toast && window.toast("Name and email are required"); return; }
    onSave({ ...f, avatar: f.avatar || initialsFor(f.name) });
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <button className="icon-btn modal-close" onClick={onClose} aria-label="Close"><Icons.X size={16} /></button>
        <h3 style={{ fontSize: 22, marginBottom: 6 }}>{isEdit ? "Edit user" : "Create user"}</h3>
        <p className="modal-desc">{isEdit
          ? `Updating ${user.name}. Role changes take effect on next sign-in.`
          : "Set up a new internal team member or external account. An invite email is sent if enabled."}</p>

        <form className="form-rows" onSubmit={submit}>
          <div className="field"><label className="field-label">Role *</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {USER_ROLES.map((r) => {
                const Icon = Icons[r.icon] || Icons.User;
                const selected = f.role === r.k;
                return (
                  <button type="button" key={r.k} onClick={() => set("role", r.k)}
                    className={"role-card" + (selected ? " is-selected" : "")}
                    style={{ padding: selected ? "11px" : "12px", gridTemplateColumns: "36px 1fr auto", textAlign: "left" }}>
                    <span className="role-card-ic" style={{ width: 36, height: 36, color: r.color, background: "var(--paper-3)", borderColor: "var(--line)" }}>
                      <Icon size={18} stroke={1.7} />
                    </span>
                    <span className="role-card-body">
                      <span className="role-card-name" style={{ fontSize: 13.5 }}>{r.label}</span>
                      <span className="role-card-desc" style={{ fontSize: 11.5 }}>{r.desc}</span>
                    </span>
                    <span className="role-card-radio" />
                  </button>
                );
              })}
            </div></div>

          <div className="auth-form-grid">
            <div className="field"><label className="field-label">Full name *</label>
              <input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Aarav Sharma" autoFocus /></div>
            <div className="field"><label className="field-label">Email *</label>
              <input className="input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder={["sales","manager","admin","hr"].includes(f.role) ? "name@nethrasap.in" : "name@example.in"} /></div>
          </div>

          <div className="auth-form-grid">
            <div className="field"><label className="field-label">Phone</label>
              <input className="input" type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" /></div>
            {["sales","manager","admin","hr"].includes(f.role) && (
              <div className="field"><label className="field-label">Department</label>
                <select className="input" value={f.department || ""} onChange={(e) => set("department", e.target.value)}>
                  <option value="">Select…</option>
                  <option>Sales</option><option>Operations</option><option>Engineering</option><option>HR</option><option>Finance</option><option>Customer Success</option>
                </select></div>
            )}
          </div>

          {!isEdit && (
            <>
              <label className="terms-check">
                <input type="checkbox" checked={f.send_invite} onChange={(e) => set("send_invite", e.target.checked)} />
                <span className="filter-check-box"><Icons.Check size={10} stroke={3} /></span>
                <span>Send an invitation email with a sign-in link. The user sets their own password on first sign-in.</span>
              </label>
              {!f.send_invite && (
                <div className="field"><label className="field-label">Temporary password</label>
                  <div className="input-affix">
                    <span className="input-affix-ic"><Icons.ShieldCheck size={15} stroke={1.7} /></span>
                    <input className="input mono" type={showPw ? "text" : "password"} value={f.password} onChange={(e) => set("password", e.target.value)} />
                    <button type="button" className="input-affix-toggle" onClick={() => setShowPw((v) => !v)} aria-label="Show">
                      {showPw ? <Icons.X size={14} /> : <Icons.Sparkle size={14} />}
                    </button>
                  </div>
                  <div className="field-hint" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>User must change on first sign-in</span>
                    <button type="button" onClick={() => set("password", genPassword())} style={{ background: "none", border: "none", color: "var(--brand-700)", fontWeight: 500, fontSize: 12 }}>Regenerate</button>
                  </div>
                </div>
              )}
            </>
          )}

          {isEdit && (
            <div className="field"><label className="field-label">Status</label>
              <div className="filter-radio-row">
                {[["active","Active"],["suspended","Suspended"]].map(([k, l]) => (
                  <button key={k} type="button" className={"filter-radio" + (f.status === k ? " is-active" : "")} onClick={() => set("status", k)}>{l}</button>
                ))}
              </div></div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, borderTop: "1px solid var(--line)", marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--ink-3)" }}>
              <div className="dtable-avatar" style={{ width: 28, height: 28 }}>{initialsFor(f.name || "?")}</div>
              <span>Preview · {f.name || "Name"} · <span className="pill pill-brand" style={{ marginLeft: 4 }}>{f.role.toUpperCase()}</span></span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary">{isEdit ? "Save changes" : "Create user"}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminUsers() {
  const D = window.NETHRA_DATA;
  const [items, setItems] = adUS(() => D.internalUsers.slice());
  const [q, setQ] = adUS("");
  const [role, setRole] = adUS("all");
  const [status, setStatus] = adUS("all");
  const [editing, setEditing] = adUS(null);
  const [deleting, setDeleting] = adUS(null);
  const [presetRole, setPresetRole] = adUS(null);

  const filtered = items.filter((u) => {
    if (q && !((u.name + " " + u.email + " " + u.phone).toLowerCase().includes(q.toLowerCase()))) return false;
    if (role !== "all" && u.role !== role) return false;
    if (status !== "all" && u.status !== status) return false;
    return true;
  });

  const save = (form) => {
    if (form.id) {
      setItems((arr) => arr.map((x) => x.id === form.id ? { ...x, ...form } : x));
      window.toast && window.toast("User updated");
    } else {
      const prefix = "U-" + form.role[0].toUpperCase();
      const id = prefix + String(Date.now()).slice(-4);
      const today = new Date().toISOString().slice(0, 10);
      const next = { ...form, id, reg: today, last_login: "—", avatar: form.avatar || initialsFor(form.name) };
      setItems((arr) => [next, ...arr]);
      window.toast && window.toast(form.send_invite ? "Invite sent · user created" : "User created");
    }
    setEditing(null);
    setPresetRole(null);
  };

  const remove = (id) => {
    setItems((arr) => arr.filter((x) => x.id !== id));
    setDeleting(null);
    window.toast && window.toast("User removed");
  };

  const toggleStatus = (id) => {
    setItems((arr) => arr.map((x) => x.id === id ? { ...x, status: x.status === "active" ? "suspended" : "active" } : x));
  };

  const startCreate = (defaultRole) => { setPresetRole(defaultRole || null); setEditing({}); };

  const roleCounts = items.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {});

  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Users</h1>
          <p className="portal-page-desc">{items.length} platform users · create, edit, suspend or remove accounts.</p>
        </div>
        <div className="portal-page-actions">
          <button className="btn btn-outline btn-sm"><Icons.Download size={13} stroke={2} /> Export CSV</button>
          <button className="btn btn-primary" onClick={() => startCreate(null)}><Icons.Plus size={14} stroke={2} /> Create user</button>
        </div>
      </div>

      <div className="quick-actions">
        <button className="quick-action" onClick={() => startCreate("manager")}><Icons.Award size={14} /> New Manager</button>
        <button className="quick-action" onClick={() => startCreate("sales")}><Icons.Users size={14} /> New Sales rep</button>
        <button className="quick-action" onClick={() => startCreate("hr")}><Icons.BadgeCheck size={14} /> New HR</button>
        <button className="quick-action" onClick={() => startCreate("admin")}><Icons.ShieldCheck size={14} /> New Admin</button>
      </div>

      <div className="kpi-grid">
        <KpiCard label="Admins"      value={roleCounts.admin    || 0} icon="ShieldCheck" />
        <KpiCard label="Managers"    value={roleCounts.manager  || 0} icon="Award" />
        <KpiCard label="Sales reps"  value={roleCounts.sales    || 0} icon="Users" />
        <KpiCard label="External"    value={(roleCounts.customer || 0) + (roleCounts.clinician || 0) + (roleCounts.retailer || 0)} icon="User" />
      </div>

      <Panel>
        <FilterBar>
          <div className="filter-bar-search">
            <Icons.Search size={14} stroke={1.7} className="filter-bar-search-ic" />
            <input className="input" placeholder="Search name, email, phone…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="sort-select" value={role} onChange={(e) => setRole(e.target.value)} style={{ height: 38 }}>
            <option value="all">All roles</option>
            <option value="customer">Customer</option><option value="clinician">Clinician</option><option value="retailer">Retailer</option>
            <option value="sales">Sales</option><option value="manager">Manager</option><option value="hr">HR</option><option value="admin">Admin</option>
          </select>
          <select className="sort-select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ height: 38 }}>
            <option value="all">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option>
          </select>
          <div className="filter-bar-spacer" />
          <span className="kicker">{filtered.length} of {items.length}</span>
        </FilterBar>
      </Panel>

      <Panel>
        {filtered.length === 0 ? (
          <EmptyPanel icon="Users" title="No users match these filters"
            actions={<><button className="btn btn-outline" onClick={() => { setQ(""); setRole("all"); setStatus("all"); }}>Clear filters</button>
              <button className="btn btn-primary" onClick={() => startCreate(null)}>Create user</button></>} />
        ) : (
          <div className="dtable-wrap">
            <table className="dtable">
              <thead><tr>
                <th><input type="checkbox" /></th>
                <th>User</th><th>Role</th><th>Status</th><th>Reg date</th><th>Last login</th><th></th>
              </tr></thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td><input type="checkbox" /></td>
                    <td>
                      <div className="tcell-name">
                        <div className="dtable-avatar">{u.avatar}</div>
                        <div>
                          <strong>{u.name}</strong>
                          <small>{u.email} · <span className="mono">{u.phone}</span></small>
                        </div>
                      </div>
                    </td>
                    <td><span className="pill pill-brand">{u.role.toUpperCase()}</span></td>
                    <td><StatusPill status={u.status} /></td>
                    <td style={{ fontSize: 12.5 }}>{u.reg}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{u.last_login}</td>
                    <td className="actions">
                      <button className="icon-btn" aria-label="Edit" onClick={() => setEditing(u)}><Icons.Edit size={14} /></button>
                      <button className="icon-btn" aria-label={u.status === "active" ? "Suspend" : "Reactivate"} onClick={() => toggleStatus(u.id)} title={u.status === "active" ? "Suspend" : "Reactivate"}>
                        {u.status === "active" ? <Icons.X size={14} /> : <Icons.Check size={14} stroke={2.4} />}
                      </button>
                      <button className="icon-btn" aria-label="Delete" onClick={() => setDeleting(u)}><Icons.Logout size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {editing && <UserFormModal user={editing.id ? editing : null} defaultRole={presetRole} onClose={() => { setEditing(null); setPresetRole(null); }} onSave={save} />}
      {deleting && <ConfirmDeleteModal
        title={`Remove "${deleting.name}"?`}
        desc={`This will permanently revoke ${deleting.name}'s access. If they have open assignments (orders, enquiries, verifications) you should reassign them first.`}
        confirmLabel="Remove user"
        onClose={() => setDeleting(null)}
        onConfirm={() => remove(deleting.id)} />}
    </>
  );
}

/* ---------- 3. Admin Roles ---------- */
function RoleModal({ role, onClose, onSave }) {
  const isNew = !role;
  const [name, setName]   = adUS(role?.name || "");
  const [desc, setDesc]   = adUS(role?.description || "");
  const [perms, setPerms] = adUS((role?.permissions || []).join(", "));
  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const permissions = perms.split(",").map((p) => p.trim()).filter(Boolean);
    onSave({ ...(role || {}), id: role?.id || name.toLowerCase().replace(/\s+/g, "-"), name: name.trim(), description: desc.trim(), permissions, builtin: role?.builtin || false, users_count: role?.users_count || 0 });
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <button className="icon-btn modal-close" onClick={onClose} aria-label="Close"><Icons.X size={16} /></button>
        <h3 style={{ fontSize: 20, marginBottom: 4 }}>{isNew ? "Create role" : "Edit role"}</h3>
        <p className="modal-desc" style={{ marginBottom: 20 }}>{isNew ? "Define a new access role for the platform." : `Editing permissions for ${role.name}.`}</p>
        <form className="form-rows" onSubmit={submit}>
          <div className="field">
            <label className="field-label">Role name *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pharmacist" autoFocus disabled={role?.builtin} />
            {role?.builtin && <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>Built-in role names cannot be changed.</p>}
          </div>
          <div className="field">
            <label className="field-label">Description</label>
            <textarea className="textarea" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Brief description of this role's access level." />
          </div>
          <div className="field">
            <label className="field-label">Permissions <span style={{ fontWeight: 400, color: "var(--ink-3)" }}>· comma-separated</span></label>
            <textarea className="textarea" rows={3} value={perms} onChange={(e) => setPerms(e.target.value)} placeholder="catalog.view, cart.use, orders.self" />
            <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>Use <code>*</code> for full access or <code>module.*</code> for module-wide access.</p>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{isNew ? "Create role" : "Save changes"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminRoles() {
  const D = window.NETHRA_DATA;
  const [roles, setRoles] = adUS([...D.rbacRoles]);
  const [editing, setEditing] = adUS(null);   // role object or "new"
  const [deleting, setDeleting] = adUS(null);

  const openEdit  = (r) => setEditing(r);
  const openNew   = () => setEditing("new");
  const closeModal = () => setEditing(null);

  const saveRole = (updated) => {
    setRoles((prev) => {
      const idx = prev.findIndex((r) => r.id === updated.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
      return [...prev, updated];
    });
    D.rbacRoles = roles.map((r) => r.id === updated.id ? updated : r);
    closeModal();
    window.toast && window.toast((editing === "new" ? "Role created" : "Role updated"), "success");
  };

  const confirmDelete = (r) => setDeleting(r);
  const doDelete = () => {
    setRoles((prev) => prev.filter((r) => r.id !== deleting.id));
    setDeleting(null);
    window.toast && window.toast("Role deleted", "success");
  };

  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Roles & permissions</h1>
          <p className="portal-page-desc">Define access boundaries for every user type on the platform.</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Icons.Plus size={14} stroke={2} /> Create role</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
        {roles.map((r) => (
          <div key={r.id} className="panel">
            <div className="panel-body">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="kpi-card-ic"><Icons.ShieldCheck size={14} stroke={1.8} /></span>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 15 }}>{r.name}</div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{r.users_count.toLocaleString("en-IN")} users</div>
                  </div>
                </div>
                {r.builtin && <span className="pill pill-outline">BUILT-IN</span>}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5, marginBottom: 14 }}>{r.description}</div>
              <div className="kicker" style={{ marginBottom: 8 }}>{r.permissions.length} permissions</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {r.permissions.slice(0, 6).map((p) => (
                  <span key={p} className="pill" style={{ background: "var(--paper-3)" }}>{p}</span>
                ))}
                {r.permissions.length > 6 && <span className="pill">+{r.permissions.length - 6}</span>}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button className="btn btn-outline btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => openEdit(r)}><Icons.Edit size={13} stroke={1.8} /> Edit</button>
                {!r.builtin && <button className="btn btn-ghost btn-sm" style={{ color: "var(--rose)" }} onClick={() => confirmDelete(r)}><Icons.X size={13} stroke={1.8} /> Delete</button>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && <RoleModal role={editing === "new" ? null : editing} onClose={closeModal} onSave={saveRole} />}

      {deleting && (
        <div className="modal-backdrop" onClick={() => setDeleting(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3 style={{ fontSize: 18, marginBottom: 8 }}>Delete role?</h3>
            <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 20 }}>
              This will permanently remove the <strong>{deleting.name}</strong> role. Users assigned this role will lose access.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setDeleting(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ background: "var(--rose)", borderColor: "var(--rose)" }} onClick={doDelete}>Delete role</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- 4. Admin Products (CRUD) ---------- */
function ProductFormModal({ product, onClose, onSave }) {
  const D = window.NETHRA_DATA;
  const isEdit = !!product;
  const initial = product || {
    name: "", brand: D.brands[0], category_slug: D.categories[0].slug,
    unit_label: "10 × 10 strip", price_min: "", price_max: "",
    stock_status: "in_stock", schedule: null, hsn_code: "",
    badge: "", delivery_time_mins: 30,
    image: null, gallery: [],
  };
  const [f, setF] = adUS(initial);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const submit = (e) => {
    e.preventDefault();
    if (!f.name || !f.price_min) { window.toast && window.toast("Name and price required"); return; }
    onSave(f);
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <button className="icon-btn modal-close" onClick={onClose} aria-label="Close"><Icons.X size={16} /></button>
        <h3 style={{ fontSize: 22, marginBottom: 6 }}>{isEdit ? "Edit product" : "Create product"}</h3>
        <p className="modal-desc">{isEdit ? `Editing ${product.name}` : "Add a new SKU to the catalog with pricing and visibility rules."}</p>
        <form className="form-rows" onSubmit={submit}>
          <div className="field"><label className="field-label">Product image</label>
            <ImagePicker value={f.image} onChange={(v) => set("image", v)} label="Cover image" hint="Square crop · shown on cards and product detail" /></div>
          <div className="field"><label className="field-label">Gallery <span style={{ fontWeight: 400, color: "var(--ink-3)" }}>· up to 8 images</span></label>
            <ImageGallery images={f.gallery || []} onChange={(g) => set("gallery", g)} max={8} /></div>
          <div className="field"><label className="field-label">Name *</label>
            <input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Amoxicillin 500mg Capsules" autoFocus /></div>
          <div className="auth-form-grid">
            <div className="field"><label className="field-label">Brand</label>
              <select className="input" value={f.brand} onChange={(e) => set("brand", e.target.value)}>{D.brands.map((b) => <option key={b}>{b}</option>)}</select></div>
            <div className="field"><label className="field-label">Category</label>
              <select className="input" value={f.category_slug} onChange={(e) => set("category_slug", e.target.value)}>{D.categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</select></div>
          </div>
          <div className="field"><label className="field-label">Pack size / unit label</label>
            <input className="input" value={f.unit_label} onChange={(e) => set("unit_label", e.target.value)} /></div>
          <div className="auth-form-grid">
            <div className="field"><label className="field-label">Min price (₹) *</label>
              <input className="input mono" type="number" value={f.price_min} onChange={(e) => set("price_min", +e.target.value)} /></div>
            <div className="field"><label className="field-label">Max price (₹)</label>
              <input className="input mono" type="number" value={f.price_max} onChange={(e) => set("price_max", +e.target.value)} /></div>
          </div>
          <div className="auth-form-grid">
            <div className="field"><label className="field-label">Stock status</label>
              <select className="input" value={f.stock_status} onChange={(e) => set("stock_status", e.target.value)}>
                <option value="in_stock">In stock</option><option value="low_stock">Low stock</option><option value="out_of_stock">Out of stock</option>
              </select></div>
            <div className="field"><label className="field-label">Schedule</label>
              <select className="input" value={f.schedule || ""} onChange={(e) => set("schedule", e.target.value || null)}>
                <option value="">Non-scheduled</option><option value="H">Schedule H</option><option value="H1">Schedule H1</option><option value="X">Schedule X</option>
              </select></div>
          </div>
          <div className="auth-form-grid">
            <div className="field"><label className="field-label">HSN code</label>
              <input className="input mono" value={f.hsn_code} onChange={(e) => set("hsn_code", e.target.value)} placeholder="3004 90" /></div>
            <div className="field"><label className="field-label">Dispatch SLA (min)</label>
              <input className="input mono" type="number" value={f.delivery_time_mins || 30} onChange={(e) => set("delivery_time_mins", +e.target.value)} /></div>
          </div>
          <div className="field"><label className="field-label">Tag / badge (optional)</label>
            <input className="input" value={f.badge || ""} onChange={(e) => set("badge", e.target.value)} placeholder="BESTSELLER, COLD CHAIN, etc." /></div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 12, borderTop: "1px solid var(--line)", marginTop: 4 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{isEdit ? "Save changes" : "Create product"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({ title, desc, confirmLabel = "Delete", onClose, onConfirm }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <button className="icon-btn modal-close" onClick={onClose} aria-label="Close"><Icons.X size={16} /></button>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
          <div className="kpi-card-ic" style={{ background: "var(--rose-bg)", color: "var(--rose)", borderColor: "transparent" }}>
            <Icons.X size={16} stroke={2} />
          </div>
          <div>
            <h3 style={{ fontSize: 18, marginBottom: 6 }}>{title}</h3>
            <p style={{ fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.5 }}>{desc}</p>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ background: "var(--rose)", borderColor: "var(--rose)" }} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function AdminProducts() {
  const D = window.NETHRA_DATA;
  const [items, setItems] = adUS(() => D.products.slice());
  const [q, setQ] = adUS("");
  const [cat, setCat] = adUS("all");
  const [stock, setStock] = adUS("all");
  const [editing, setEditing] = adUS(null);          // product object or {} for new
  const [deleting, setDeleting] = adUS(null);        // product to delete

  const filtered = items.filter((p) => {
    if (q && !((p.name + " " + p.brand + " " + p.id).toLowerCase().includes(q.toLowerCase()))) return false;
    if (cat !== "all" && p.category_slug !== cat) return false;
    if (stock !== "all" && p.stock_status !== stock) return false;
    return true;
  });

  const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const save = (form) => {
    if (form.id) {
      // edit
      setItems((arr) => arr.map((x) => x.id === form.id ? {
        ...x, ...form,
        category_name: (D.categories.find((c) => c.slug === form.category_slug) || {}).name || x.category_name,
        price_max: form.price_max || form.price_min,
        slug: slugify(form.name),
      } : x));
      window.toast && window.toast("Product updated");
    } else {
      // create
      const id = "p" + (items.length + 1) + "n" + Date.now().toString(36).slice(-4);
      const cat = D.categories.find((c) => c.slug === form.category_slug);
      const next = {
        ...form,
        id,
        slug: slugify(form.name),
        category_name: cat ? cat.name : form.category_slug,
        price_max: form.price_max || form.price_min,
        rating: 0, reviews: 0, is_featured: false,
        batch: "B" + (3000 + items.length), expiry: "2028-12-31",
        manufacturer_address: form.brand + ", India",
        sub_category: (D.subcategories[form.category_slug] || [""])[0],
        specs: [], review_list: [],
      };
      setItems((arr) => [next, ...arr]);
      window.toast && window.toast("Product created");
    }
    setEditing(null);
  };

  const remove = (id) => {
    setItems((arr) => arr.filter((x) => x.id !== id));
    setDeleting(null);
    window.toast && window.toast("Product deleted");
  };

  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Products</h1>
          <p className="portal-page-desc">{items.length} SKUs in catalog · manage pricing, status, inventory.</p>
        </div>
        <div className="portal-page-actions">
          <button className="btn btn-outline btn-sm"><Icons.Download size={13} stroke={2} /> Bulk CSV</button>
          <button className="btn btn-primary" onClick={() => setEditing({})}><Icons.Plus size={14} stroke={2} /> Add product</button>
        </div>
      </div>

      <Panel>
        <FilterBar>
          <div className="filter-bar-search">
            <Icons.Search size={14} stroke={1.7} className="filter-bar-search-ic" />
            <input className="input" placeholder="Search by name, SKU, brand…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="sort-select" style={{ height: 38 }} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="all">All categories</option>
            {D.categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
          <select className="sort-select" style={{ height: 38 }} value={stock} onChange={(e) => setStock(e.target.value)}>
            <option value="all">All stock</option>
            <option value="in_stock">In stock</option><option value="low_stock">Low stock</option><option value="out_of_stock">Out of stock</option>
          </select>
          <div className="filter-bar-spacer" />
          <span className="kicker">{filtered.length} of {items.length}</span>
        </FilterBar>
      </Panel>

      <Panel>
        {filtered.length === 0 ? (
          <EmptyPanel icon="Package" title="No products match your filters"
            actions={<><button className="btn btn-outline" onClick={() => { setQ(""); setCat("all"); setStock("all"); }}>Clear filters</button>
              <button className="btn btn-primary" onClick={() => setEditing({})}>Add product</button></>} />
        ) : (
          <div className="dtable-wrap">
            <table className="dtable">
              <thead><tr><th></th><th>Product</th><th>SKU</th><th>Category</th><th className="num">Price</th><th>Stock</th><th></th></tr></thead>
              <tbody>
                {filtered.slice(0, 30).map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.image
                        ? <div className="row-image"><img src={p.image} alt="" /></div>
                        : <div style={{ width: 40, height: 40 }}><ProductTile product={p} size="sm" /></div>}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{p.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{p.brand} · {p.unit_label}</div>
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>{p.id.toUpperCase()}</td>
                    <td style={{ fontSize: 12 }}>{p.category_name}</td>
                    <td className="num">₹{(p.price_min || 0).toLocaleString("en-IN")}</td>
                    <td><StatusPill status={p.stock_status === "in_stock" ? "active" : p.stock_status === "low_stock" ? "pending" : "expired"} /></td>
                    <td className="actions">
                      <button className="icon-btn" aria-label="Edit" onClick={() => setEditing(p)}><Icons.Edit size={14} /></button>
                      <button className="icon-btn" aria-label="Delete" onClick={() => setDeleting(p)}><Icons.X size={14} /></button>
                      <a className="icon-btn" href={"product.html?slug=" + p.slug} aria-label="View"><Icons.ArrowR size={14} /></a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {editing && <ProductFormModal product={editing.id ? editing : null} onClose={() => setEditing(null)} onSave={save} />}
      {deleting && <ConfirmDeleteModal
        title={`Delete "${deleting.name}"?`}
        desc={`This will permanently remove the SKU ${deleting.id.toUpperCase()} from the catalog. Past orders and invoices are unaffected.`}
        confirmLabel="Delete product"
        onClose={() => setDeleting(null)}
        onConfirm={() => remove(deleting.id)} />}
    </>
  );
}

/* ---------- 5. Admin Categories (CRUD) ---------- */
const GLYPH_OPTIONS = ["Pill","Apple","Stethoscope","Syringe","Beaker","Baby","Snowflake","Sparkle","Package","ShieldCheck","Award","BadgeCheck"];

function CategoryFormModal({ category, onClose, onSave }) {
  const isEdit = !!category;
  const initial = category || {
    name: "", slug: "", description: "", sku: "", glyph: "Pill",
    product_count: 0, active: true, subcategories: [],
    image: null,
  };
  const [f, setF] = adUS(initial);
  const [subInput, setSubInput] = adUS("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const setName = (v) => setF((x) => ({ ...x, name: v, slug: x._slugManual ? x.slug : slugify(v) }));
  const addSub = () => {
    if (!subInput.trim()) return;
    setF((x) => ({ ...x, subcategories: [...(x.subcategories || []), subInput.trim()] }));
    setSubInput("");
  };
  const removeSub = (i) => setF((x) => ({ ...x, subcategories: x.subcategories.filter((_, idx) => idx !== i) }));
  const submit = (e) => {
    e.preventDefault();
    if (!f.name || !f.slug || !f.sku) { window.toast && window.toast("Name, slug and code are required"); return; }
    onSave(f);
  };
  const GlyphPreview = Icons[f.glyph] || Icons.Pill;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <button className="icon-btn modal-close" onClick={onClose} aria-label="Close"><Icons.X size={16} /></button>
        <h3 style={{ fontSize: 22, marginBottom: 6 }}>{isEdit ? "Edit category" : "Create category"}</h3>
        <p className="modal-desc">{isEdit ? `Editing ${category.name}` : "Add a new top-level category for the catalog."}</p>
        <form className="form-rows" onSubmit={submit}>
          <div className="field"><label className="field-label">Banner image</label>
            <ImagePicker value={f.image} onChange={(v) => set("image", v)} label="Category banner" aspect="4 / 3"
              hint="Shown on category cards and the category landing page · landscape crop preferred" /></div>
          <div className="auth-form-grid">
            <div className="field"><label className="field-label">Name *</label>
              <input className="input" value={f.name} onChange={(e) => setName(e.target.value)} placeholder="Cardio-Metabolic" autoFocus /></div>
            <div className="field"><label className="field-label">Code (SKU prefix) *</label>
              <input className="input mono" value={f.sku} onChange={(e) => set("sku", e.target.value.toUpperCase())} maxLength={4} placeholder="CV" /></div>
          </div>
          <div className="field"><label className="field-label">Slug *</label>
            <input className="input mono" value={f.slug} onChange={(e) => { set("slug", slugify(e.target.value)); set("_slugManual", true); }} placeholder="cardio-metabolic" />
            <div className="field-hint">/category.html?slug=<strong>{f.slug || "your-slug"}</strong></div></div>
          <div className="field"><label className="field-label">Description</label>
            <textarea className="textarea" value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Hypertension, diabetes, lipids" /></div>
          <div className="field"><label className="field-label">Icon glyph</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {GLYPH_OPTIONS.map((g) => {
                const I = Icons[g];
                const selected = f.glyph === g;
                return (
                  <button key={g} type="button"
                    onClick={() => set("glyph", g)}
                    style={{
                      width: 44, height: 44, borderRadius: 10,
                      border: selected ? "2px solid var(--brand-700)" : "1px solid var(--line)",
                      background: selected ? "var(--brand-50)" : "var(--paper-2)",
                      color: selected ? "var(--brand-700)" : "var(--ink-2)",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer",
                    }}><I size={18} stroke={1.7} /></button>
                );
              })}
            </div></div>
          <div className="field"><label className="field-label">Subcategories</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="input" value={subInput} onChange={(e) => setSubInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSub(); } }}
                placeholder="Type and press Enter" />
              <button type="button" className="btn btn-outline" onClick={addSub}>Add</button>
            </div>
            {(f.subcategories || []).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {f.subcategories.map((s, i) => (
                  <span key={i} className="active-filter">{s}
                    <button type="button" onClick={() => removeSub(i)}><Icons.X size={11} stroke={2.2} /></button>
                  </span>
                ))}
              </div>
            )}</div>
          <label className="terms-check">
            <input type="checkbox" checked={f.active !== false} onChange={(e) => set("active", e.target.checked)} />
            <span className="filter-check-box"><Icons.Check size={10} stroke={3} /></span>
            <span>Category visible on the storefront</span></label>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, borderTop: "1px solid var(--line)", marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--ink-3)" }}>
              <div className="kpi-card-ic"><GlyphPreview size={14} stroke={1.7} /></div>
              Preview · {f.name || "Category name"} · <span className="mono">{f.sku || "—"}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary">{isEdit ? "Save changes" : "Create category"}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminCategories() {
  const D = window.NETHRA_DATA;
  const initial = D.categories.map((c) => ({
    ...c,
    active: c.active !== false,
    subcategories: D.subcategories[c.slug] ? D.subcategories[c.slug].slice() : [],
  }));
  const [items, setItems] = adUS(initial);
  const [editing, setEditing] = adUS(null);
  const [deleting, setDeleting] = adUS(null);

  const save = (form) => {
    if (form.id) {
      setItems((arr) => arr.map((x) => x.id === form.id ? { ...x, ...form } : x));
      window.toast && window.toast("Category updated");
    } else {
      const id = "c" + (items.length + 1) + "n" + Date.now().toString(36).slice(-4);
      setItems((arr) => [...arr, { ...form, id, product_count: 0 }]);
      window.toast && window.toast("Category created");
    }
    setEditing(null);
  };

  const remove = (id) => {
    setItems((arr) => arr.filter((x) => x.id !== id));
    setDeleting(null);
    window.toast && window.toast("Category deleted");
  };

  const toggleActive = (id) => {
    setItems((arr) => arr.map((x) => x.id === id ? { ...x, active: !x.active } : x));
  };

  const move = (id, dir) => {
    setItems((arr) => {
      const idx = arr.findIndex((x) => x.id === id);
      const next = idx + dir;
      if (next < 0 || next >= arr.length) return arr;
      const copy = arr.slice();
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  };

  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Categories</h1>
          <p className="portal-page-desc">{items.length} categories · reorder, toggle active, manage subcategories.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({})}><Icons.Plus size={14} stroke={2} /> Add category</button>
      </div>

      <Panel>
        {items.length === 0 ? (
          <EmptyPanel icon="Grid" title="No categories yet"
            actions={<button className="btn btn-primary" onClick={() => setEditing({})}>Add the first category</button>} />
        ) : (
          <div className="dtable-wrap">
            <table className="dtable">
              <thead><tr><th></th><th>Name</th><th>Slug</th><th className="num">Products</th><th>Subcategories</th><th>Active</th><th>Order</th><th></th></tr></thead>
              <tbody>
                {items.map((c, i) => {
                  const Icon = Icons[c.glyph] || Icons.Pill;
                  return (
                    <tr key={c.id}>
                      <td style={{ width: 50 }}>
                        <div className={"cat-emblem" + (c.image ? " has-img" : "")}>
                          {c.image && <img src={c.image} alt="" />}
                          {!c.image && <Icon size={18} stroke={1.7} />}
                          {c.image && <Icon size={14} stroke={2} style={{ position: "absolute", right: 4, bottom: 4, color: "var(--cream)", zIndex: 1 }} />}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{c.name} <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)", marginLeft: 6 }}>{c.sku}</span></div>
                        <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{c.description}</div>
                      </td>
                      <td className="mono" style={{ fontSize: 12 }}>/{c.slug}</td>
                      <td className="num">{(c.product_count || 0).toLocaleString("en-IN")}</td>
                      <td style={{ fontSize: 12 }}>
                        {(c.subcategories || []).length === 0 ? "—" :
                          <>{c.subcategories.length} · {c.subcategories.slice(0,2).join(", ")}{c.subcategories.length > 2 ? "…" : ""}</>}
                      </td>
                      <td>
                        <label className="toggle">
                          <input type="checkbox" checked={c.active !== false} onChange={() => toggleActive(c.id)} />
                          <span className="toggle-track" /><span className="toggle-thumb" />
                        </label>
                      </td>
                      <td>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span className="num" style={{ minWidth: 16 }}>{i + 1}</span>
                          <button className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => move(c.id, -1)} style={{ width: 24, height: 24, opacity: i === 0 ? 0.3 : 1 }}>
                            <Icons.ChevL size={12} stroke={2} style={{ transform: "rotate(90deg)" }} />
                          </button>
                          <button className="icon-btn" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(c.id, 1)} style={{ width: 24, height: 24, opacity: i === items.length - 1 ? 0.3 : 1 }}>
                            <Icons.ChevL size={12} stroke={2} style={{ transform: "rotate(-90deg)" }} />
                          </button>
                        </div>
                      </td>
                      <td className="actions">
                        <button className="icon-btn" aria-label="Edit" onClick={() => setEditing(c)}><Icons.Edit size={14} /></button>
                        <button className="icon-btn" aria-label="Delete" onClick={() => setDeleting(c)}><Icons.X size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {editing && <CategoryFormModal category={editing.id ? editing : null} onClose={() => setEditing(null)} onSave={save} />}
      {deleting && <ConfirmDeleteModal
        title={`Delete "${deleting.name}"?`}
        desc={`This will remove the category and unlink ${deleting.product_count || 0} product${deleting.product_count === 1 ? "" : "s"}. Products are not deleted — they become uncategorized.`}
        confirmLabel="Delete category"
        onClose={() => setDeleting(null)}
        onConfirm={() => remove(deleting.id)} />}
    </>
  );
}

/* ---------- 6. Admin Inventory ---------- */
function AdjustStockModal({ item, onClose, onSave }) {
  const [stock, setStock]   = adUS(item?.stock ?? "");
  const [reorder, setReorder] = adUS(item?.reorder_point ?? 80);
  const [note, setNote]     = adUS("");
  const submit = (e) => {
    e.preventDefault();
    const newStock = parseInt(stock, 10);
    if (isNaN(newStock) || newStock < 0) return;
    const status = newStock === 0 ? "out_of_stock" : newStock <= reorder ? "low_stock" : "in_stock";
    onSave({ ...item, stock: newStock, reorder_point: parseInt(reorder, 10) || 80, status, last_restocked: new Date().toISOString().slice(0, 10) });
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <button className="icon-btn modal-close" onClick={onClose} aria-label="Close"><Icons.X size={16} /></button>
        <h3 style={{ fontSize: 20, marginBottom: 4 }}>Adjust stock</h3>
        {item && <p className="modal-desc" style={{ marginBottom: 20 }}><strong>{item.name}</strong> · SKU {item.sku}</p>}
        <form className="form-rows" onSubmit={submit}>
          <div className="auth-form-grid">
            <div className="field">
              <label className="field-label">New stock quantity *</label>
              <input className="input mono" type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} autoFocus />
              {item && <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>Current: <strong>{item.stock}</strong> units</p>}
            </div>
            <div className="field">
              <label className="field-label">Reorder point</label>
              <input className="input mono" type="number" min="0" value={reorder} onChange={(e) => setReorder(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label className="field-label">Adjustment note <span style={{ fontWeight: 400, color: "var(--ink-3)" }}>· optional</span></label>
            <textarea className="textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Restock from Cipla warehouse batch #441" />
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save adjustment</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminInventory() {
  const D = window.NETHRA_DATA;
  const [filter, setFilter]   = adUS("all");
  const [inventory, setInventory] = adUS([...D.inventory]);
  const [adjusting, setAdjusting] = adUS(null); // item being adjusted, or "new"

  const total   = inventory.length;
  const inStock = inventory.filter((i) => i.status === "in_stock").length;
  const low     = inventory.filter((i) => i.status === "low_stock").length;
  const out     = inventory.filter((i) => i.status === "out_of_stock").length;
  const filtered = inventory.filter((i) => filter === "all" ? true : i.status === filter);

  const openAdjust = (item) => setAdjusting(item);
  const closeModal  = () => setAdjusting(null);

  const saveAdjustment = (updated) => {
    setInventory((prev) => prev.map((i) => i.id === updated.id ? updated : i));
    D.inventory = inventory.map((i) => i.id === updated.id ? updated : i);
    closeModal();
    window.toast && window.toast("Stock updated for " + updated.name, "success");
  };

  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Inventory</h1>
          <p className="portal-page-desc">Stock levels across all warehouses. Set reorder points and trigger restocks.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openAdjust(inventory[0])}><Icons.Plus size={14} stroke={2} /> Adjust stock</button>
      </div>

      <div className="kpi-grid">
        <KpiCard label="Total SKUs"   value={total}   icon="Package" />
        <KpiCard label="In stock"     value={inStock} icon="Check" />
        <KpiCard label="Low stock"    value={low}     icon="Sparkle" />
        <KpiCard label="Out of stock" value={out}     icon="X" />
      </div>

      <div className="tab-row">
        {[["all","All"],["in_stock","In stock"],["low_stock","Low stock"],["out_of_stock","Out of stock"]].map(([k, l]) => (
          <button key={k} className={"tab-row-item" + (filter === k ? " is-active" : "")} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      <Panel>
        <div className="dtable-wrap">
          <table className="dtable">
            <thead><tr><th>SKU</th><th>Name</th><th>Brand</th><th className="num">Stock</th><th className="num">Reorder pt</th><th className="num">Reserved</th><th className="num">Available</th><th>Last restocked</th><th></th></tr></thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} style={{ background: i.status === "out_of_stock" ? "rgba(239,68,68,0.04)" : i.status === "low_stock" ? "rgba(245,158,11,0.04)" : undefined }}>
                  <td className="mono" style={{ fontSize: 12 }}>{i.sku}</td>
                  <td style={{ fontWeight: 500 }}>{i.name}</td>
                  <td style={{ fontSize: 12 }}>{i.brand}</td>
                  <td className="num"><strong style={{ color: i.status === "out_of_stock" ? "var(--rose)" : i.status === "low_stock" ? "var(--amber)" : undefined }}>{i.stock}</strong></td>
                  <td className="num">{i.reorder_point}</td>
                  <td className="num">{i.reserved}</td>
                  <td className="num"><strong>{i.stock - i.reserved}</strong></td>
                  <td style={{ fontSize: 12 }}>{i.last_restocked}</td>
                  <td className="actions">
                    <button className="btn btn-outline btn-sm" onClick={() => openAdjust(i)}>Adjust</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {adjusting && <AdjustStockModal item={adjusting} onClose={closeModal} onSave={saveAdjustment} />}
    </>
  );
}

/* ---------- 7. Admin Analytics (reuse ManagerAnalytics) ---------- */
function AdminAnalytics() {
  const D = (typeof window !== "undefined" ? window.NETHRA_DATA : null) || {};
  if (!D.kpi?.admin || !Array.isArray(D.salesTeam) || !Array.isArray(D.categories) || !Array.isArray(D.products) || !Array.isArray(D.revenueTrend)) {
    return <div style={{ padding: 32, color: "var(--ink-3)" }}>Loading analytics…</div>;
  }
  const k = D.kpi.admin;
  const team = D.salesTeam.slice().sort((a, b) => b.revenue - a.revenue);
  const maxRev = team[0]?.revenue || 1;
  const topProducts = (D.products || [])
    .slice()
    .sort((a, b) => b.price_max * b.reviews - a.price_max * a.reviews)
    .slice(0, 8);
  const maxProd = topProducts[0] ? topProducts[0].price_max * topProducts[0].reviews : 1;
  const health = D.settings?.health || [];

  return (
    <>
      {/* Page header */}
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Analytics</h1>
          <p className="portal-page-desc">Platform-wide revenue, operations, and system health.</p>
        </div>
        <div className="portal-page-actions">
          <select className="sort-select" style={{ height: 38 }}>
            <option>Last 30 days</option>
            <option>Last 90 days</option>
            <option>This quarter</option>
            <option>Year to date</option>
          </select>
          <button className="btn btn-outline btn-sm"><Icons.Download size={13} stroke={2} /> Export PDF</button>
        </div>
      </div>

      <div className="bento-grid">

        {/* ── Tile 1: Total Revenue (featured, accent) ── */}
        <div className="bento-tile is-accent">
          <div className="bento-tile-head">
            <span className="bento-label">Total Revenue</span>
            <span className="bento-tile-icon"><Icons.Award size={16} stroke={1.8} /></span>
          </div>
          <div className="bento-value">₹{(k.total_revenue / 10000000).toFixed(2)}Cr</div>
          <div className="bento-delta"><span className="up">↑ 11.4%</span> vs last month</div>
        </div>

        {/* ── Tile 2: Total Orders ── */}
        <div className="bento-tile">
          <div className="bento-tile-head">
            <span className="bento-label">Total Orders</span>
            <span className="bento-tile-icon"><Icons.Package size={16} stroke={1.8} /></span>
          </div>
          <div className="bento-value">{k.total_orders.toLocaleString("en-IN")}</div>
          <div className="bento-delta"><span className="up">↑ 8.1%</span> vs last month</div>
        </div>

        {/* ── Tile 3: Active Orders ── */}
        <div className="bento-tile">
          <div className="bento-tile-head">
            <span className="bento-label">Active Orders</span>
            <span className="bento-tile-icon"><Icons.Truck size={16} stroke={1.8} /></span>
          </div>
          <div className="bento-value">{k.active_orders}</div>
          <div className="bento-delta" style={{ color: "var(--amber)" }}>In transit right now</div>
        </div>

        {/* ── Tile 4: New Users ── */}
        <div className="bento-tile">
          <div className="bento-tile-head">
            <span className="bento-label">New Users · 30d</span>
            <span className="bento-tile-icon"><Icons.Sparkle size={16} stroke={1.8} /></span>
          </div>
          <div className="bento-value">{k.new_users_30d}</div>
          <div className="bento-delta"><span className="up">↑ 14%</span> vs last month</div>
        </div>

        {/* ── Tile 5: Revenue Trend (spans 3, 2 rows tall) ── */}
        <div className="bento-tile span-3 row-2">
          <div className="bento-tile-head">
            <div>
              <div className="bento-label">Revenue trend</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>Daily · last 30 days</div>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <LineChart data={D.revenueTrend} height={260} />
          </div>
        </div>

        {/* ── Tile 6: Orders by Status (donut) ── */}
        <div className="bento-tile">
          <span className="bento-label">Orders by status</span>
          <DonutChart size={140} data={[
            { label: "Delivered",        value: 218, color: "var(--chart-1)" },
            { label: "Dispatched",       value: 84,  color: "var(--chart-2)" },
            { label: "Out for delivery", value: 41,  color: "var(--chart-4)" },
            { label: "Cancelled",        value: 18,  color: "var(--rose)"    },
            { label: "Pending",          value: 31,  color: "var(--chart-6)" },
          ]} />
        </div>

        {/* ── Tile 7: Revenue by Role (donut) ── */}
        <div className="bento-tile">
          <span className="bento-label">Revenue by role</span>
          <DonutChart size={140} data={[
            { label: "Retailer",  value: 1248, color: "var(--chart-1)" },
            { label: "Clinician", value: 412,  color: "var(--chart-5)" },
            { label: "Customer",  value: 184,  color: "var(--chart-3)" },
          ]} />
        </div>

        {/* ── Tile 8: Payment + Uptime stats ── */}
        <div className="bento-tile span-2">
          <span className="bento-label">Platform health</span>
          {health.map((h, i) => (
            <div key={i} className="bento-health-row">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className={"bento-health-dot" + (h.status !== "ok" ? " warn" : "")} />
                <span style={{ fontSize: 13 }}>{h.component}</span>
              </div>
              <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>{h.response}</span>
            </div>
          ))}
        </div>

        {/* ── Tile 9: Key metrics strip ── */}
        <div className="bento-tile">
          <span className="bento-label">Key metrics</span>
          <div className="bento-stat-row">
            <span>Total users</span>
            <span className="mono" style={{ fontWeight: 600 }}>{k.total_users.toLocaleString("en-IN")}</span>
          </div>
          <div className="bento-stat-row">
            <span>Payment success</span>
            <span className="mono" style={{ fontWeight: 600, color: "#16a34a" }}>{k.payment_success}%</span>
          </div>
          <div className="bento-stat-row">
            <span>Uptime</span>
            <span className="mono" style={{ fontWeight: 600, color: "#16a34a" }}>{k.uptime}%</span>
          </div>
          <div className="bento-stat-row">
            <span>Pending enquiries</span>
            <span className="mono" style={{ fontWeight: 600, color: "var(--amber)" }}>{k.pending_enquiries}</span>
          </div>
        </div>

        {/* ── Tile 10: Category snapshot ── */}
        <div className="bento-tile">
          <div className="bento-tile-head">
            <span className="bento-label">Category snapshot</span>
            <span className="bento-tile-icon"><Icons.Grid size={15} stroke={1.8} /></span>
          </div>
          {D.categories.map((c, i) => {
            const pct = Math.round((c.product_count / D.categories[0].product_count) * 100);
            const colors = ["var(--chart-1)","var(--chart-5)","var(--chart-4)","var(--chart-2)","var(--chart-3)","var(--rose)","var(--chart-6)","var(--amber)"];
            return (
              <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "7px 0", borderBottom: i < D.categories.length - 1 ? "1px solid var(--line)" : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{c.name}</span>
                  <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{c.product_count.toLocaleString("en-IN")} SKUs</span>
                </div>
                <div style={{ height: 4, background: "var(--paper-3)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: pct + "%", background: colors[i], borderRadius: 999 }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Tile 11: Top products bar rows (full width) ── */}
        <div className="bento-tile span-4">
          <div className="bento-tile-head">
            <span className="bento-label">Top products by revenue</span>
            <a href="/admin-products" className="btn btn-outline btn-sm" style={{ fontSize: 12 }}>
              View all <Icons.ArrowR size={12} stroke={2} />
            </a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 40px" }}>
            {topProducts.map((p) => (
              <BarRow key={p.id} name={p.name}
                value={p.price_max * (p.reviews || 1)}
                max={maxProd}
                format={(v) => "₹" + (v / 100000).toFixed(1) + "L"} />
            ))}
          </div>
        </div>

        {/* ── Tile 11: Team leaderboard (full width) ── */}
        <div className="bento-tile span-4">
          <div className="bento-tile-head">
            <span className="bento-label">Sales team · revenue leaderboard</span>
            <a href="/manager-team" className="btn btn-outline btn-sm" style={{ fontSize: 12 }}>
              Full view <Icons.ArrowR size={12} stroke={2} />
            </a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0 32px" }}>
            {team.slice(0, 6).map((t, i) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)", width: 18, textAlign: "center" }}>#{i + 1}</span>
                <div className="dtable-avatar" style={{ fontSize: 13 }}>{t.avatar}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{t.orders} orders</div>
                </div>
                <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--chart-1)" }}>
                  ₹{(t.revenue / 100000).toFixed(1)}L
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}

/* ---------- 8. Admin CMS (tabs) ---------- */
function AdminCms() {
  const D = window.NETHRA_DATA;
  const [tab, setTab] = adUS("hero");
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Content management</h1>
          <p className="portal-page-desc">Update hero slides, FAQs, and certificates shown on the storefront.</p>
        </div>
        <button className="btn btn-outline"><Icons.ExtLink size={13} stroke={2} /> Preview live</button>
      </div>

      <div className="tab-row">
        {[["hero","Hero slides"],["faq","FAQs"],["cert","Certificates"]].map(([k, l]) => (
          <button key={k} className={"tab-row-item" + (tab === k ? " is-active" : "")} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === "hero" && (
        <Panel action={<button className="btn btn-primary btn-sm"><Icons.Plus size={13} /> Add slide</button>}>
          <div className="dtable-wrap">
            <table className="dtable">
              <thead><tr><th>Order</th><th>Headline</th><th>Subheadline</th><th>CTA</th><th>Active</th><th></th></tr></thead>
              <tbody>
                {D.heroSlides.map((s, i) => (
                  <tr key={s.id}>
                    <td className="num"><strong>{i + 1}</strong></td>
                    <td style={{ fontWeight: 500 }}>{s.headline}</td>
                    <td style={{ fontSize: 12, color: "var(--ink-3)" }}>{s.subheadline}</td>
                    <td style={{ fontSize: 12 }}>{s.cta_text}</td>
                    <td><label className="toggle"><input type="checkbox" defaultChecked /><span className="toggle-track" /><span className="toggle-thumb" /></label></td>
                    <td className="actions"><button className="icon-btn"><Icons.Edit size={14} /></button><button className="icon-btn"><Icons.X size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {tab === "faq" && (
        <Panel action={<button className="btn btn-primary btn-sm"><Icons.Plus size={13} /> Add FAQ</button>}>
          {D.faqs.map((f, i) => (
            <div key={f.id} style={{ padding: "14px 0", borderBottom: "1px solid var(--line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 14.5 }}>{i + 1}. {f.question}</div>
                  <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 6, lineHeight: 1.5 }}>{f.answer.slice(0, 140)}…</div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                  <label className="toggle"><input type="checkbox" defaultChecked /><span className="toggle-track" /><span className="toggle-thumb" /></label>
                  <button className="icon-btn"><Icons.Edit size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </Panel>
      )}

      {tab === "cert" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          {D.certificates.map((c) => (
            <div key={c.id} className="panel">
              <div className="panel-body">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div className="cert-card-logo" style={{ width: 36, height: 36 }}>{c.issuer.split(" ").slice(0,2).map((w) => w[0]).join("").toUpperCase()}</div>
                  <StatusPill status={c.status === "active" ? "active" : c.status === "expiring" ? "pending" : "expired"} />
                </div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{c.issuer}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 8 }}>{c.credential_id}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                  <button className="btn btn-outline btn-sm" style={{ flex: 1, justifyContent: "center" }}>Edit</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: "var(--rose)" }}><Icons.X size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------- 9. Admin Settings ---------- */
function AdminSettings() {
  const s = window.NETHRA_DATA.settings;
  const [tab, setTab] = adUS("general");
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">System settings</h1>
          <p className="portal-page-desc">Platform configuration, integrations, security, and health.</p>
        </div>
        <div className="portal-page-actions">
          <button className="btn btn-ghost">Restore defaults</button>
          <button className="btn btn-primary">Save all</button>
        </div>
      </div>

      <div className="tab-row">
        {[["general","General"],["payment","Payment"],["email","Email & SMS"],["flags","Feature flags"],["security","Security"],["health","System health"]].map(([k, l]) => (
          <button key={k} className={"tab-row-item" + (tab === k ? " is-active" : "")} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === "general" && (
        <Panel title="General">
          <div className="form-rows">
            <div className="auth-form-grid">
              <div className="field"><label className="field-label">App name</label><input className="input" defaultValue={s.general.app_name} /></div>
              <div className="field"><label className="field-label">Timezone</label><input className="input" defaultValue={s.general.timezone} /></div>
            </div>
            <div className="field"><label className="field-label">Tagline</label><input className="input" defaultValue={s.general.tagline} /></div>
            <div className="auth-form-grid">
              <div className="field"><label className="field-label">Date format</label><input className="input" defaultValue={s.general.date_format} /></div>
              <div className="field"><label className="field-label">Currency</label><input className="input" defaultValue={s.general.currency} /></div>
            </div>
          </div>
        </Panel>
      )}

      {tab === "payment" && (
        <Panel title="Payment gateway" sub={"Connected to " + s.payment.provider + " · " + s.payment.mode}>
          <div className="form-rows">
            <div className="auth-form-grid">
              <div className="field"><label className="field-label">Provider</label><input className="input" defaultValue={s.payment.provider} /></div>
              <div className="field"><label className="field-label">Mode</label><select className="input"><option>Live</option><option>Test</option></select></div>
            </div>
            <div className="field"><label className="field-label">Razorpay key</label><input className="input mono" defaultValue={s.payment.key} /></div>
            <div>
              <label className="field-label" style={{ display: "block", marginBottom: 10 }}>Enabled methods</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {s.payment.methods.map((m) => <span key={m} className="pill pill-emerald">{m}</span>)}
              </div>
            </div>
            <button className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }}>Test connection</button>
          </div>
        </Panel>
      )}

      {tab === "email" && (
        <Panel title="Email · SMTP">
          <div className="form-rows">
            <div className="auth-form-grid">
              <div className="field"><label className="field-label">SMTP host</label><input className="input" defaultValue={s.email.smtp_host} /></div>
              <div className="field"><label className="field-label">SMTP port</label><input className="input" defaultValue={s.email.smtp_port} /></div>
            </div>
            <div className="auth-form-grid">
              <div className="field"><label className="field-label">From email</label><input className="input" defaultValue={s.email.from_email} /></div>
              <div className="field"><label className="field-label">From name</label><input className="input" defaultValue={s.email.from_name} /></div>
            </div>
            <button className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }}>Send test email</button>
          </div>
        </Panel>
      )}

      {tab === "flags" && (
        <Panel title="Feature flags">
          {s.flags.map((f) => (
            <div key={f.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid var(--line)" }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{f.label}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }} className="mono">{f.k}</div>
              </div>
              <label className="toggle"><input type="checkbox" defaultChecked={f.enabled} /><span className="toggle-track" /><span className="toggle-thumb" /></label>
            </div>
          ))}
        </Panel>
      )}

      {tab === "security" && (
        <Panel title="Security">
          <div className="form-rows">
            <div className="auth-form-grid">
              <div className="field"><label className="field-label">Password min length</label><input className="input" type="number" defaultValue={s.security.pw_min} /></div>
              <div className="field"><label className="field-label">Session timeout (min)</label><input className="input" type="number" defaultValue={s.security.session_timeout} /></div>
            </div>
            <div className="auth-form-grid">
              <div className="field"><label className="field-label">OTP expiry (min)</label><input className="input" type="number" defaultValue={s.security.otp_expiry} /></div>
              <div className="field"><label className="field-label">Rate limit (req/min)</label><input className="input" type="number" defaultValue={s.security.rate_limit} /></div>
            </div>
            <label className="terms-check">
              <input type="checkbox" defaultChecked={s.security.two_factor} />
              <span className="filter-check-box"><Icons.Check size={10} stroke={3} /></span>
              <span>Require two-factor authentication for admin / manager accounts</span>
            </label>
          </div>
        </Panel>
      )}

      {tab === "health" && (
        <Panel title="System health" sub="Read-only · live values">
          <div className="dtable-wrap">
            <table className="dtable">
              <thead><tr><th>Component</th><th>Status</th><th>Response / value</th></tr></thead>
              <tbody>
                {s.health.map((h) => (
                  <tr key={h.component}>
                    <td style={{ fontWeight: 500 }}>{h.component}</td>
                    <td><span className="pill pill-emerald">{h.status.toUpperCase()}</span></td>
                    <td className="mono" style={{ fontSize: 12 }}>{h.response}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <button className="btn btn-primary"><Icons.Download size={13} stroke={2} /> Run backup now</button>
            <button className="btn btn-outline btn-sm">Refresh</button>
          </div>
        </Panel>
      )}
    </>
  );
}

/* ---------- 10. HR Employees ---------- */
function EmployeeModal({ emp, onClose, onSave }) {
  const isNew = !emp;
  const [name,  setName]  = adUS(emp?.name || "");
  const [email, setEmail] = adUS(emp?.email || "");
  const [phone, setPhone] = adUS(emp?.phone || "");
  const [dept,  setDept]  = adUS(emp?.department || "Engineering");
  const [role,  setRole]  = adUS(emp?.role || "sales");
  const [pos,   setPos]   = adUS(emp?.position || "");
  const [start, setStart] = adUS(emp?.start_date || new Date().toISOString().slice(0,10));
  const [status,setStatus]= adUS(emp?.status || "active");
  const submit = (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    const initials = name.trim().split(" ").map((w) => w[0]).join("").toUpperCase().slice(0,2);
    onSave({ ...(emp||{}), id: emp?.id || ("E-" + String(Date.now()).slice(-4)), name: name.trim(), email: email.trim(), phone, department: dept, role, position: pos.trim(), start_date: start, status, avatar: initials, last_login: emp?.last_login || "—" });
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <button className="icon-btn modal-close" onClick={onClose} aria-label="Close"><Icons.X size={16} /></button>
        <h3 style={{ fontSize: 20, marginBottom: 4 }}>{isNew ? "Add employee" : "Edit employee"}</h3>
        <p className="modal-desc" style={{ marginBottom: 20 }}>{isNew ? "Add a new employee to the HR directory." : `Editing profile for ${emp.name}`}</p>
        <form className="form-rows" onSubmit={submit}>
          <div className="auth-form-grid">
            <div className="field"><label className="field-label">Full name *</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Nair" autoFocus /></div>
            <div className="field"><label className="field-label">Email *</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="priya@nethrasap.in" /></div>
          </div>
          <div className="auth-form-grid">
            <div className="field"><label className="field-label">Phone</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 99001 90099" /></div>
            <div className="field"><label className="field-label">Start date</label><input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          </div>
          <div className="auth-form-grid">
            <div className="field"><label className="field-label">Department</label>
              <select className="input" value={dept} onChange={(e) => setDept(e.target.value)}>
                {["Engineering","Sales","Operations","HR","Finance","Marketing"].map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="field"><label className="field-label">Role</label>
              <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
                {["admin","manager","sales","hr","customer"].map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="auth-form-grid">
            <div className="field"><label className="field-label">Position / title</label><input className="input" value={pos} onChange={(e) => setPos(e.target.value)} placeholder="Senior Engineer" /></div>
            <div className="field"><label className="field-label">Status</label>
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="active">Active</option><option value="inactive">Inactive</option><option value="on_leave">On leave</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{isNew ? "Add employee" : "Save changes"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EmployeeProfileModal({ emp, onClose }) {
  if (!emp) return null;
  const rows = [["ID", emp.id], ["Email", emp.email], ["Phone", emp.phone], ["Department", emp.department], ["Position", emp.position], ["Role", emp.role?.toUpperCase()], ["Start date", emp.start_date], ["Last login", emp.last_login], ["Status", emp.status]];
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <button className="icon-btn modal-close" onClick={onClose} aria-label="Close"><Icons.X size={16} /></button>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div className="dtable-avatar" style={{ width: 48, height: 48, fontSize: 18 }}>{emp.avatar}</div>
          <div><div style={{ fontWeight: 600, fontSize: 17 }}>{emp.name}</div><div style={{ fontSize: 13, color: "var(--ink-3)" }}>{emp.position} · {emp.department}</div></div>
        </div>
        <div className="form-rows">
          {rows.map(([label, val]) => val && (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
              <span style={{ color: "var(--ink-3)" }}>{label}</span>
              <span style={{ fontWeight: 500 }}>{val}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function HrEmployees() {
  const D = window.NETHRA_DATA;
  const [q, setQ]             = adUS("");
  const [employees, setEmps]  = adUS([...D.employees]);
  const [editing, setEditing] = adUS(null);   // emp object or "new"
  const [viewing, setViewing] = adUS(null);   // emp object for profile modal

  const filtered = employees.filter((e) => !q || (e.name + e.email + e.department).toLowerCase().includes(q.toLowerCase()));

  const saveEmployee = (updated) => {
    setEmps((prev) => {
      const idx = prev.findIndex((e) => e.id === updated.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
      return [...prev, updated];
    });
    setEditing(null);
    window.toast && window.toast((editing === "new" ? "Employee added" : "Employee updated"), "success");
  };

  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Employees</h1>
          <p className="portal-page-desc">{employees.length} employees on payroll · across {[...new Set(employees.map((e) => e.department))].length} departments.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing("new")}><Icons.Plus size={14} stroke={2} /> Add employee</button>
      </div>

      <Panel>
        <FilterBar>
          <div className="filter-bar-search">
            <Icons.Search size={14} stroke={1.7} className="filter-bar-search-ic" />
            <input className="input" placeholder="Search by name, email, dept…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="sort-select" style={{ height: 38 }}>
            <option>All departments</option><option>Engineering</option><option>Sales</option><option>Operations</option><option>HR</option><option>Finance</option>
          </select>
        </FilterBar>
      </Panel>

      <Panel>
        <div className="dtable-wrap">
          <table className="dtable">
            <thead><tr><th>Employee</th><th>Department</th><th>Role · Position</th><th>Start date</th><th>Status</th><th>Last login</th><th></th></tr></thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div className="tcell-name">
                      <div className="dtable-avatar">{e.avatar}</div>
                      <div>
                        <strong>{e.name}</strong>
                        <small>{e.email} · <span className="mono">{e.id}</span></small>
                      </div>
                    </div>
                  </td>
                  <td>{e.department}</td>
                  <td><span className="pill pill-brand">{e.role.toUpperCase()}</span> {e.position}</td>
                  <td style={{ fontSize: 12.5 }}>{e.start_date}</td>
                  <td><StatusPill status={e.status} /></td>
                  <td className="mono" style={{ fontSize: 12 }}>{e.last_login}</td>
                  <td className="actions">
                    <button className="icon-btn" title="Edit employee" onClick={() => setEditing(e)}><Icons.Edit size={14} /></button>
                    <button className="icon-btn" title="View profile"  onClick={() => setViewing(e)}><Icons.Eye size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {editing && <EmployeeModal emp={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSave={saveEmployee} />}
      {viewing && <EmployeeProfileModal emp={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

/* ---------- 11. HR Leave Requests ---------- */
function LeaveApplyModal({ employees, onClose, onSave }) {
  const [emp,    setEmp]   = adUS(employees[0]?.id || "");
  const [type,   setType]  = adUS("casual");
  const [start,  setStart] = adUS("");
  const [end,    setEnd]   = adUS("");
  const [reason, setReason]= adUS("");
  const submit = (e) => {
    e.preventDefault();
    if (!start || !end) return;
    const days = Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000) + 1);
    const employee = employees.find((x) => x.id === emp) || employees[0];
    onSave({ id: "LR-" + String(Date.now()).slice(-4), employee: { name: employee.name, department: employee.department, avatar: employee.avatar }, type, start, end, days, reason, status: "pending" });
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <button className="icon-btn modal-close" onClick={onClose} aria-label="Close"><Icons.X size={16} /></button>
        <h3 style={{ fontSize: 20, marginBottom: 4 }}>Apply on behalf</h3>
        <p className="modal-desc" style={{ marginBottom: 20 }}>Submit a leave request for an employee.</p>
        <form className="form-rows" onSubmit={submit}>
          <div className="field"><label className="field-label">Employee</label>
            <select className="input" value={emp} onChange={(e) => setEmp(e.target.value)}>
              {employees.map((x) => <option key={x.id} value={x.id}>{x.name} — {x.department}</option>)}
            </select>
          </div>
          <div className="auth-form-grid">
            <div className="field"><label className="field-label">Leave type</label>
              <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
                {["casual","sick","earned","maternity","paternity","unpaid"].map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </div>
            <div className="field"><label className="field-label">Reason</label>
              <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Brief reason" />
            </div>
          </div>
          <div className="auth-form-grid">
            <div className="field"><label className="field-label">Start date *</label><input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} required /></div>
            <div className="field"><label className="field-label">End date *</label><input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} required /></div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Submit request</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HrLeave() {
  const D = window.NETHRA_DATA;
  const [tab,      setTab]     = adUS("all");
  const [requests, setRequests]= adUS([...D.leaveRequests]);
  const [applying, setApplying]= adUS(false);

  const filtered = requests.filter((l) => tab === "all" ? true : l.status === tab);
  const pending  = requests.filter((l) => l.status === "pending").length;

  const updateStatus = (id, status) => {
    setRequests((prev) => prev.map((l) => l.id === id ? { ...l, status } : l));
    window.toast && window.toast(status === "approved" ? "Request approved" : "Request rejected", "success");
  };

  const addRequest = (req) => {
    setRequests((prev) => [req, ...prev]);
    setApplying(false);
    window.toast && window.toast("Leave request submitted", "success");
  };

  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Leave requests</h1>
          <p className="portal-page-desc">{pending} pending approvals · approval rate this month is 88%.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setApplying(true)}><Icons.Plus size={14} stroke={2} /> Apply on behalf</button>
      </div>

      <div className="tab-row">
        {[["all","All"],["pending","Pending"],["approved","Approved"],["rejected","Rejected"]].map(([k, l]) => (
          <button key={k} className={"tab-row-item" + (tab === k ? " is-active" : "")} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      <Panel>
        <div className="dtable-wrap">
          <table className="dtable">
            <thead><tr><th>Request</th><th>Employee</th><th>Type</th><th>Dates</th><th className="num">Days</th><th>Reason</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id}>
                  <td><span className="mono">{l.id}</span></td>
                  <td>
                    <div className="tcell-name">
                      <div className="dtable-avatar">{l.employee.avatar}</div>
                      <div>
                        <strong>{l.employee.name}</strong>
                        <small>{l.employee.department}</small>
                      </div>
                    </div>
                  </td>
                  <td><span className="pill pill-brand">{l.type.toUpperCase()}</span></td>
                  <td style={{ fontSize: 12 }}>{l.start} – {l.end}</td>
                  <td className="num">{l.days}</td>
                  <td style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{l.reason}</td>
                  <td><StatusPill status={l.status} /></td>
                  <td className="actions">
                    {l.status === "pending" && (
                      <>
                        <button className="btn btn-primary btn-sm" onClick={() => updateStatus(l.id, "approved")}>Approve</button>
                        <button className="btn btn-outline btn-sm" onClick={() => updateStatus(l.id, "rejected")}>Reject</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {applying && <LeaveApplyModal employees={D.employees} onClose={() => setApplying(false)} onSave={addRequest} />}
    </>
  );
}

/* ---------- 12. HR Payroll ---------- */
function HrPayroll() {
  const D = window.NETHRA_DATA;
  const total = D.payroll.reduce((s, p) => s + p.net, 0);
  const processed = D.payroll.filter((p) => p.status === "processed").length;
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Payroll · May 2026</h1>
          <p className="portal-page-desc">{processed}/{D.payroll.length} processed · total net ₹{total.toLocaleString("en-IN")}.</p>
        </div>
        <div className="portal-page-actions">
          <button className="btn btn-outline btn-sm">Process all</button>
          <button className="btn btn-primary"><Icons.Mail size={14} stroke={2} /> Send slips</button>
        </div>
      </div>

      <Panel>
        <div className="dtable-wrap">
          <table className="dtable">
            <thead><tr><th>Employee</th><th>Department</th><th className="num">Basic</th><th className="num">Allowances</th><th className="num">Deductions</th><th className="num">Net</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {D.payroll.map((p) => (
                <tr key={p.employee.id}>
                  <td>
                    <div className="tcell-name">
                      <div className="dtable-avatar">{p.employee.avatar}</div>
                      <div>
                        <strong>{p.employee.name}</strong>
                        <small>{p.employee.position}</small>
                      </div>
                    </div>
                  </td>
                  <td>{p.employee.department}</td>
                  <td className="num">₹{p.basic.toLocaleString("en-IN")}</td>
                  <td className="num">₹{p.allowances.toLocaleString("en-IN")}</td>
                  <td className="num" style={{ color: "var(--rose)" }}>−₹{p.deductions.toLocaleString("en-IN")}</td>
                  <td className="num"><strong>₹{p.net.toLocaleString("en-IN")}</strong></td>
                  <td><StatusPill status={p.status} /></td>
                  <td className="actions"><button className="icon-btn"><Icons.Download size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

/* ---------- 13. HR Holidays ---------- */
function HolidayModal({ holiday, onClose, onSave }) {
  const isNew = !holiday;
  const [date,       setDate]      = adUS(holiday?.date || "");
  const [name,       setName]      = adUS(holiday?.name || "");
  const [type,       setType]      = adUS(holiday?.type || "national");
  const [isWorking,  setIsWorking] = adUS(holiday?.is_working || false);
  const submit = (e) => {
    e.preventDefault();
    if (!date || !name.trim()) return;
    onSave({ ...(holiday || {}), date, name: name.trim(), type, is_working: isWorking });
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <button className="icon-btn modal-close" onClick={onClose} aria-label="Close"><Icons.X size={16} /></button>
        <h3 style={{ fontSize: 20, marginBottom: 4 }}>{isNew ? "Add holiday" : "Edit holiday"}</h3>
        <p className="modal-desc" style={{ marginBottom: 20 }}>{isNew ? "Add a new holiday to the 2026 calendar." : `Editing ${holiday.name}`}</p>
        <form className="form-rows" onSubmit={submit}>
          <div className="auth-form-grid">
            <div className="field"><label className="field-label">Date *</label><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required autoFocus /></div>
            <div className="field"><label className="field-label">Type</label>
              <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
                {["national","regional","optional","restricted"].map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label className="field-label">Holiday name *</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Diwali" /></div>
          <label className="terms-check" style={{ alignSelf: "flex-start" }}>
            <input type="checkbox" checked={isWorking} onChange={(e) => setIsWorking(e.target.checked)} />
            <span className="filter-check-box"><Icons.Check size={10} stroke={3} /></span>
            <span style={{ fontSize: 13 }}>Working day (optional / restricted)</span>
          </label>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{isNew ? "Add holiday" : "Save changes"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HrHolidays() {
  const D = window.NETHRA_DATA;
  const [holidays,  setHolidays] = adUS([...D.holidays]);
  const [editing,   setEditing]  = adUS(null);  // holiday object or "new"
  const [deletingH, setDeletingH]= adUS(null);

  const saveHoliday = (updated) => {
    setHolidays((prev) => {
      const idx = prev.findIndex((h) => h.date === updated.date && editing !== "new");
      if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
      return [...prev, updated].sort((a, b) => a.date.localeCompare(b.date));
    });
    setEditing(null);
    window.toast && window.toast(editing === "new" ? "Holiday added" : "Holiday updated", "success");
  };

  const doDelete = () => {
    setHolidays((prev) => prev.filter((h) => h.date !== deletingH.date));
    setDeletingH(null);
    window.toast && window.toast("Holiday removed", "success");
  };

  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Holidays · 2026</h1>
          <p className="portal-page-desc">{holidays.length} holidays scheduled this year.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing("new")}><Icons.Plus size={14} stroke={2} /> Add holiday</button>
      </div>

      <Panel>
        <div className="dtable-wrap">
          <table className="dtable">
            <thead><tr><th>Date</th><th>Holiday</th><th>Type</th><th>Working day</th><th></th></tr></thead>
            <tbody>
              {holidays.map((h) => (
                <tr key={h.date}>
                  <td className="mono" style={{ fontSize: 12 }}>{h.date}</td>
                  <td style={{ fontWeight: 500 }}>{h.name}</td>
                  <td><span className="pill pill-brand">{h.type.toUpperCase()}</span></td>
                  <td>{h.is_working ? <Icons.Check size={14} stroke={2.4} /> : <Icons.X size={14} stroke={2.2} style={{ color: "var(--ink-3)" }} />}</td>
                  <td className="actions">
                    <button className="icon-btn" title="Edit" onClick={() => setEditing(h)}><Icons.Edit size={14} /></button>
                    <button className="icon-btn" title="Delete" onClick={() => setDeletingH(h)}><Icons.X size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {editing && <HolidayModal holiday={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSave={saveHoliday} />}

      {deletingH && (
        <div className="modal-backdrop" onClick={() => setDeletingH(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3 style={{ fontSize: 18, marginBottom: 8 }}>Remove holiday?</h3>
            <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 20 }}>Remove <strong>{deletingH.name}</strong> ({deletingH.date}) from the calendar?</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setDeletingH(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ background: "var(--rose)", borderColor: "var(--rose)" }} onClick={doDelete}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- 14. Admin Orders / Enquiries (reuse) ---------- */
function AdminOrders() { return <SalesOrders portal="admin" />; }
function AdminEnquiries() { return <SalesEnquiriesList portal="admin" />; }

if (typeof window !== "undefined") Object.assign(window, {
  AdminDashboard, AdminUsers, AdminRoles, AdminProducts, AdminCategories,
  AdminInventory, AdminAnalytics, AdminCms, AdminSettings,
  HrEmployees, HrLeave, HrPayroll, HrHolidays,
  AdminOrders, AdminEnquiries,
});

/* ============== auth-pages.jsx ============== */
/* ===========================================================
   Auth pages — Login, Signup, Forgot password
   =========================================================== */
const { useState: aUS, useEffect: aUE, useRef: aUR, useMemo: aUM } = React;

/* ----- Role definitions ----- */
const ROLES = [
  {
    k: "customer",
    label: "Customer",
    desc: "Browse OTC, wellness and prescribed products for yourself or your family.",
    icon: "User",
    image: "pharmacyCounter",
    eyebrow: "FOR INDIVIDUALS",
    title: "Verified medicine, delivered to your door.",
    sub: "Sign up in under two minutes. No business credentials needed for OTC and wellness lines — only for scheduled drugs.",
    perks: [
      "Authentic, batch-traceable inventory",
      "Standard 7-day return on most lines",
      "Same-day dispatch on orders before 4 PM IST",
    ],
    fields: ["full_name", "email", "phone"],
  },
  {
    k: "clinician",
    label: "Clinician",
    desc: "I'm a doctor, surgeon or hospital staffer ordering for clinical use.",
    icon: "Stethoscope",
    image: "consultation",
    eyebrow: "FOR CLINICIANS & HOSPITALS",
    title: "Institutional pricing, on credentials we trust.",
    sub: "Verified IMC or state medical council registration unlocks a 6–10% institutional discount tier and bulk PO ordering.",
    perks: [
      "6–10% institutional discount on most lines",
      "Bulk PO across categories with one statement",
      "Cold-chain validated lanes for biologics",
    ],
    fields: ["full_name", "email", "phone", "council", "council_no", "specialization", "hospital"],
    kyc: { title: "Council registration certificate", sub: "PDF or image · max 5 MB", icon: "BadgeCheck" },
  },
  {
    k: "retailer",
    label: "Retailer",
    desc: "I run a pharmacy or wholesale buying for retail use.",
    icon: "Building",
    image: "warehouseAisle",
    eyebrow: "FOR PHARMACIES & RETAILERS",
    title: "Wholesale margins, with no middlemen.",
    sub: "Upload your CDSCO 20B/21B drug license and GSTIN. We extend Net-30 credit after the qualification window.",
    perks: [
      "Up to 22% margin across categories",
      "Net-30 credit terms (after qualification)",
      "Single PO, one statement, GST-2A reconciled",
    ],
    fields: ["business_name", "owner_name", "email", "phone", "drug_license_no", "gstin", "pan", "address_line", "city", "state", "pin"],
    kyc: { title: "CDSCO 20B/21B drug license", sub: "PDF or image · max 5 MB", icon: "ShieldCheck" },
  },
];

/* ----- helpers ----- */
function getRole(k) { return ROLES.find((r) => r.k === k) || ROLES[0]; }

function pwStrength(pw) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}
function pwLabel(s) {
  return ["Use 8+ chars, mix case, a digit and a symbol", "Too weak", "Decent — add a symbol", "Strong", "Excellent"][s];
}

/* ----- shared visual side ----- */
function AuthSide({ role, alt }) {
  const r = role || ROLES[0];
  const photo = (IMG[r.image] || IMG.pharmacyCounter)(1400, 1200);
  return (
    <aside className="auth-side">
      <img className="auth-side-photo" src={photo} alt="" />
      <div className="auth-side-overlay" />

      <div className="auth-side-top">
        <Logo dark />
        <a className="auth-side-link" href="/">
          <Icons.ArrowR size={13} stroke={2} style={{ transform: "rotate(180deg)" }} /> Back to home
        </a>
      </div>

      <div className="auth-side-body">
        <div className="auth-side-eyebrow">
          <span className="bar" />
          {r.eyebrow}
        </div>
        <h2 className="auth-side-title">{alt || r.title}</h2>
        <p className="auth-side-sub">{r.sub}</p>

        <div className="auth-perks">
          {r.perks.map((p, i) => (
            <div className="auth-perk" key={i}>
              <div className="auth-perk-ic"><Icons.Check size={14} stroke={2.4} /></div>
              <span>{p}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="auth-side-foot">
        <div className="auth-side-foot-pills">
          <span className="auth-side-foot-pill"><Icons.ShieldCheck size={11} stroke={1.8} /> WHO-GDP</span>
          <span className="auth-side-foot-pill"><Icons.BadgeCheck size={11} stroke={1.8} /> CDSCO 20B/21B</span>
          <span className="auth-side-foot-pill">DPDP Act · 2023</span>
        </div>
      </div>
    </aside>
  );
}

/* ----- LOGIN ----- */
function LoginPage() {
  const [mode, setMode] = aUS("email");
  const [showPw, setShowPw] = aUS(false);
  const [email, setEmail] = aUS("");
  const [phone, setPhone] = aUS("");
  const [pw, setPw] = aUS("");
  const [otpSent, setOtpSent] = aUS(false);
  const [loading, setLoading] = aUS(false);

  const submit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      window.toast && window.toast("Signed in · welcome back");
      setLoading(false);
      setTimeout(() => { window.location.href = "/"; }, 600);
    }, 900);
  };
  const sendOtp = () => {
    if (!phone) { window.toast && window.toast("Enter your phone"); return; }
    setOtpSent(true);
    window.toast && window.toast("OTP sent to " + phone);
  };

  return (
    <div className="auth-shell">
      <section className="auth-form-pane">
        <div className="auth-form-pane-inner">
          <a className="auth-back" href="/"><Icons.ArrowR size={13} stroke={2} style={{ transform: "rotate(180deg)" }} /> Back</a>
          <div>
            <h1 className="auth-h1">Sign in to your account</h1>
            <p className="auth-sub">Welcome back — pick up where you left off. Buyers, clinicians and retailers all sign in here.</p>
          </div>

          <div className="demo-access">
            <div className="demo-access-head">
              <span className="demo-access-eyebrow">
                <Icons.Sparkle size={11} stroke={2.2} /> Demo access
              </span>
              <span className="demo-access-note">No validation · jump straight in</span>
            </div>
            <div className="demo-access-grid">
              {[
                { k: "customer", label: "Customer",  desc: "Shop, track orders, enquiries",     href: "/dashboard",         icon: "Cart",        accent: "var(--brand-700)" },
                { k: "sales",    label: "Sales",     desc: "Pipeline, orders, team",            href: "/sales-dashboard",   icon: "Truck",       accent: "#1f7a5a" },
                { k: "manager",  label: "Manager",   desc: "Analytics, approvals, performance", href: "/manager-dashboard", icon: "Award",       accent: "#a5611d" },
                { k: "admin",    label: "Admin",     desc: "Catalog, users, CMS, settings",     href: "/admin-dashboard",   icon: "ShieldCheck", accent: "#5b3aa0" },
              ].map((r) => {
                const Ic = Icons[r.icon];
                return (
                  <a key={r.k} className="demo-card" href={r.href} style={{ "--accent": r.accent }}>
                    <span className="demo-card-ic"><Ic size={16} stroke={1.7} /></span>
                    <span className="demo-card-body">
                      <span className="demo-card-label">{r.label}</span>
                      <span className="demo-card-desc">{r.desc}</span>
                    </span>
                    <Icons.ArrowR size={13} stroke={2} className="demo-card-arrow" />
                  </a>
                );
              })}
            </div>
          </div>

          <div className="auth-mode-tabs">
            <button type="button" className={"auth-mode-tab" + (mode === "email" ? " is-active" : "")} onClick={() => setMode("email")}>Email</button>
            <button type="button" className={"auth-mode-tab" + (mode === "phone" ? " is-active" : "")} onClick={() => setMode("phone")}>Phone OTP</button>
          </div>

          <form className="auth-form" onSubmit={submit}>
            {mode === "email" && (
              <>
                <div className="field">
                  <label className="field-label">Email</label>
                  <div className="input-affix">
                    <span className="input-affix-ic"><Icons.Mail size={15} stroke={1.7} /></span>
                    <input className="input" type="email" placeholder="you@pharmacy.in" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                </div>
                <div className="field">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label className="field-label">Password</label>
                    <a href="/forgot-password" style={{ fontSize: 12, color: "var(--brand-700)", fontWeight: 500 }}>Forgot?</a>
                  </div>
                  <div className="input-affix">
                    <span className="input-affix-ic"><Icons.ShieldCheck size={15} stroke={1.7} /></span>
                    <input className="input" type={showPw ? "text" : "password"} placeholder="••••••••" value={pw} onChange={(e) => setPw(e.target.value)} required />
                    <button type="button" className="input-affix-toggle" onClick={() => setShowPw((v) => !v)} aria-label="Show password">
                      {showPw ? <Icons.X size={14} /> : <Icons.Sparkle size={14} />}
                    </button>
                  </div>
                </div>
                <label className="terms-check">
                  <input type="checkbox" defaultChecked />
                  <span className="filter-check-box"><Icons.Check size={10} stroke={3} /></span>
                  <span>Keep me signed in on this device</span>
                </label>
                <button className="btn btn-primary btn-lg" type="submit" style={{ justifyContent: "center" }} disabled={loading}>
                  {loading ? <><span className="spinner" /> Signing in…</> : <>Sign in <Icons.ArrowR size={14} stroke={2} /></>}
                </button>
              </>
            )}

            {mode === "phone" && !otpSent && (
              <>
                <div className="field">
                  <label className="field-label">Phone</label>
                  <div className="input-affix">
                    <span className="input-affix-ic"><Icons.Phone size={15} stroke={1.7} /></span>
                    <input className="input" type="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                  </div>
                  <div className="field-hint">We'll text a 6-digit code · standard SMS rates apply</div>
                </div>
                <button type="button" className="btn btn-primary btn-lg" onClick={sendOtp} style={{ justifyContent: "center" }}>
                  Send OTP <Icons.ArrowR size={14} stroke={2} />
                </button>
              </>
            )}

            {mode === "phone" && otpSent && (
              <>
                <div className="field">
                  <label className="field-label">Enter the 6-digit code we sent to {phone}</label>
                  <OtpInput length={6} />
                  <div className="field-hint" style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                    <span>Code expires in 4:59</span>
                    <button type="button" onClick={() => setOtpSent(false)} style={{ background: "none", border: "none", color: "var(--brand-700)", fontWeight: 500, fontSize: 12 }}>Change number</button>
                  </div>
                </div>
                <button type="submit" className="btn btn-primary btn-lg" style={{ justifyContent: "center" }} disabled={loading}>
                  {loading ? <><span className="spinner" /> Verifying…</> : <>Verify & sign in <Icons.Check size={14} stroke={2.4} /></>}
                </button>
              </>
            )}
          </form>

          <div className="auth-divider">OR CONTINUE WITH</div>
          <div className="auth-socials">
            <button className="auth-social-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44c-.28 1.5-1.12 2.78-2.41 3.62v3.01h3.89c2.28-2.1 3.57-5.2 3.57-8.87z"/><path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.89-3.01c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.76-2.1-6.7-4.93H1.27v3.09C3.24 21.3 7.31 24 12 24z"/><path fill="#FBBC04" d="M5.3 14.31c-.23-.7-.36-1.45-.36-2.31s.13-1.61.36-2.31V6.6H1.27C.46 8.21 0 10.05 0 12s.46 3.79 1.27 5.4L5.3 14.3z"/><path fill="#EA4335" d="M12 4.75c1.76 0 3.34.61 4.59 1.79l3.43-3.43C17.95 1.19 15.24 0 12 0 7.31 0 3.24 2.7 1.27 6.6L5.3 9.69c.94-2.83 3.58-4.94 6.7-4.94z"/></svg>
              Google
            </button>
            <button className="auth-social-btn">
              <Icons.BadgeCheck size={16} stroke={1.8} />
              DigiLocker
            </button>
          </div>

          <div style={{ textAlign: "center", fontSize: 13.5, color: "var(--ink-3)" }}>
            New to nethrasap? <a href="/signup" style={{ color: "var(--brand-700)", fontWeight: 500 }}>Create an account</a>
          </div>
        </div>
      </section>

      <AuthSide role={ROLES[2]} alt="Welcome back. Your supply ledger is right where you left it." />
    </div>
  );
}

/* ----- OTP input ----- */
function OtpInput({ length = 6 }) {
  const refs = aUR([]);
  const [vals, setVals] = aUS(Array(length).fill(""));
  const onInput = (i, v) => {
    const ch = v.slice(-1);
    if (!/\d?/.test(ch)) return;
    setVals((arr) => { const n = [...arr]; n[i] = ch; return n; });
    if (ch && refs.current[i + 1]) refs.current[i + 1].focus();
  };
  const onKey = (i, e) => {
    if (e.key === "Backspace" && !vals[i] && refs.current[i - 1]) refs.current[i - 1].focus();
  };
  return (
    <div className="otp-row">
      {Array.from({ length }).map((_, i) => (
        <input key={i}
               ref={(el) => refs.current[i] = el}
               className="otp-cell mono"
               inputMode="numeric"
               maxLength={1}
               value={vals[i]}
               onChange={(e) => onInput(i, e.target.value)}
               onKeyDown={(e) => onKey(i, e)} />
      ))}
    </div>
  );
}

/* ----- SIGNUP ----- */
function SignupPage() {
  const [step, setStep] = aUS(1);          // 1: role, 2: details, 3: KYC (if needed), 4: success
  const [roleK, setRoleK] = aUS("retailer");
  const [data, setData] = aUS({});
  const [pw, setPw] = aUS("");
  const [showPw, setShowPw] = aUS(false);
  const [agree, setAgree] = aUS(false);
  const [uploaded, setUploaded] = aUS(null);
  const [loading, setLoading] = aUS(false);
  const role = getRole(roleK);
  const totalSteps = role.kyc ? 3 : 2;

  const goNext = () => { setStep((s) => s + 1); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const goBack = () => { setStep((s) => Math.max(1, s - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const finish = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); setStep(totalSteps + 1); }, 1100);
  };

  const update = (key, val) => setData((d) => ({ ...d, [key]: val }));
  const fld = (key, label, type = "text", icon = "User", placeholder = "") => (
    <div className="field">
      <label className="field-label">{label}</label>
      <div className="input-affix">
        <span className="input-affix-ic">{React.createElement(Icons[icon] || Icons.User, { size: 15, stroke: 1.7 })}</span>
        <input className="input" type={type} placeholder={placeholder} value={data[key] || ""} onChange={(e) => update(key, e.target.value)} required />
      </div>
    </div>
  );

  return (
    <div className="auth-shell is-wide">
      <section className="auth-form-pane">
        <div className="auth-form-pane-inner">
          {step > 1 && step <= totalSteps && (
            <button className="auth-back" onClick={goBack} style={{ background: "none", border: "none", padding: 0 }}>
              <Icons.ArrowR size={13} stroke={2} style={{ transform: "rotate(180deg)" }} /> Back
            </button>
          )}
          {step === 1 && (
            <a className="auth-back" href="/"><Icons.ArrowR size={13} stroke={2} style={{ transform: "rotate(180deg)" }} /> Back to home</a>
          )}

          {step <= totalSteps && (
            <div className="signup-stepper">
              {[1, 2, ...(role.kyc ? [3] : [])].map((n, i, arr) => (
                <React.Fragment key={n}>
                  <span className={"signup-step" + (step === n ? " is-active" : step > n ? " is-done" : "")}>
                    <span className="signup-step-num">{step > n ? <Icons.Check size={11} stroke={3} /> : n}</span>
                    {n === 1 ? "Role" : n === 2 ? "Details" : "Verify"}
                  </span>
                  {i < arr.length - 1 && <span className="signup-step-sep" />}
                </React.Fragment>
              ))}
            </div>
          )}

          {step === 1 && (
            <>
              <div>
                <h1 className="auth-h1">Create your account</h1>
                <p className="auth-sub">Pick the role that fits — we'll surface the right pricing tier and the right verification steps for you.</p>
              </div>
              <div className="role-grid">
                {ROLES.map((r) => {
                  const Icon = Icons[r.icon];
                  return (
                    <button key={r.k}
                            className={"role-card" + (roleK === r.k ? " is-selected" : "")}
                            onClick={() => setRoleK(r.k)}>
                      <span className="role-card-ic"><Icon size={22} stroke={1.6} /></span>
                      <span className="role-card-body">
                        <span className="role-card-name">{r.label}</span>
                        <span className="role-card-desc">{r.desc}</span>
                      </span>
                      <span className="role-card-radio" />
                    </button>
                  );
                })}
              </div>
              <button className="btn btn-primary btn-lg" onClick={goNext} style={{ justifyContent: "center" }}>
                Continue as {role.label} <Icons.ArrowR size={14} stroke={2} />
              </button>
              <div style={{ textAlign: "center", fontSize: 13.5, color: "var(--ink-3)" }}>
                Already have an account? <a href="/login" style={{ color: "var(--brand-700)", fontWeight: 500 }}>Sign in</a>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h1 className="auth-h1">Tell us about {roleK === "customer" ? "you" : "your business"}</h1>
                <p className="auth-sub">
                  {roleK === "customer" && "We'll set you up with a customer profile. You can upgrade to clinician or retailer later."}
                  {roleK === "clinician" && "We'll verify your council registration before unlocking institutional pricing."}
                  {roleK === "retailer" && "We'll verify your drug license and GST credentials before unlocking wholesale pricing."}
                </p>
              </div>

              <form className="auth-form" onSubmit={(e) => { e.preventDefault(); goNext(); }}>
                {roleK === "customer" && (
                  <>
                    {fld("full_name", "Full name", "text", "User", "Priya Iyer")}
                    <div className="auth-form-grid">
                      {fld("email", "Email", "email", "Mail", "you@example.in")}
                      {fld("phone", "Phone", "tel", "Phone", "+91 98765 43210")}
                    </div>
                  </>
                )}

                {roleK === "clinician" && (
                  <>
                    {fld("full_name", "Full name", "text", "User", "Dr. Kavita Menon")}
                    <div className="auth-form-grid">
                      {fld("email", "Work email", "email", "Mail", "you@hospital.in")}
                      {fld("phone", "Phone", "tel", "Phone", "+91")}
                    </div>
                    <div className="auth-form-grid">
                      <div className="field">
                        <label className="field-label">Medical council</label>
                        <select className="input" value={data.council || ""} onChange={(e) => update("council", e.target.value)}>
                          <option value="">Select council</option>
                          <option>Medical Council of India (IMC)</option>
                          <option>Karnataka Medical Council</option>
                          <option>Maharashtra Medical Council</option>
                          <option>Tamil Nadu Medical Council</option>
                          <option>Delhi Medical Council</option>
                        </select>
                      </div>
                      {fld("council_no", "Registration number", "text", "Hash", "e.g. KMC-72840")}
                    </div>
                    <div className="auth-form-grid">
                      {fld("specialization", "Specialization", "text", "Stethoscope", "e.g. Endocrinology")}
                      {fld("hospital", "Hospital / Clinic", "text", "Building", "Apollo Hospitals · Bangalore")}
                    </div>
                  </>
                )}

                {roleK === "retailer" && (
                  <>
                    <div className="auth-form-grid">
                      {fld("business_name", "Business name", "text", "Building", "Sunrise Chemists Pvt. Ltd.")}
                      {fld("owner_name", "Signatory / owner name", "text", "User", "Rajesh Mehta")}
                    </div>
                    <div className="auth-form-grid">
                      {fld("email", "Work email", "email", "Mail", "orders@pharmacy.in")}
                      {fld("phone", "Phone", "tel", "Phone", "+91")}
                    </div>
                    <div className="auth-form-grid">
                      {fld("drug_license_no", "Drug license (20B/21B)", "text", "ShieldCheck", "e.g. MH-MUM-2024/2-13841")}
                      {fld("gstin", "GSTIN", "text", "Hash", "27AABCN9012P1Z3")}
                    </div>
                    {fld("pan", "PAN", "text", "BadgeCheck", "AABCN9012P")}
                    {fld("address_line", "Business address", "text", "Pin", "Shop 12, Linking Road, Bandra West")}
                    <div className="auth-form-grid">
                      {fld("city", "City", "text", "Pin", "Mumbai")}
                      {fld("state", "State", "text", "Pin", "Maharashtra")}
                    </div>
                    {fld("pin", "PIN code", "text", "Pin", "400050")}
                  </>
                )}

                <div className="field">
                  <label className="field-label">Choose a password</label>
                  <div className="input-affix">
                    <span className="input-affix-ic"><Icons.ShieldCheck size={15} stroke={1.7} /></span>
                    <input className="input" type={showPw ? "text" : "password"} placeholder="Min 8 characters" value={pw} onChange={(e) => setPw(e.target.value)} required />
                    <button type="button" className="input-affix-toggle" onClick={() => setShowPw((v) => !v)} aria-label="Show password">
                      {showPw ? <Icons.X size={14} /> : <Icons.Sparkle size={14} />}
                    </button>
                  </div>
                  <div className={"pw-meter s" + pwStrength(pw)}>
                    <span /><span /><span /><span />
                  </div>
                  <div className="pw-hint">{pwLabel(pwStrength(pw))}</div>
                </div>

                <label className="terms-check">
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                  <span className="filter-check-box"><Icons.Check size={10} stroke={3} /></span>
                  <span>I agree to nethrasap's <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>, including DPDP Act consent for the use of my credentials.</span>
                </label>

                <button type="submit" className="btn btn-primary btn-lg" style={{ justifyContent: "center" }} disabled={!agree || pwStrength(pw) < 2}>
                  {role.kyc ? "Continue to verification" : "Create account"} <Icons.ArrowR size={14} stroke={2} />
                </button>
              </form>
            </>
          )}

          {step === 3 && role.kyc && (
            <>
              <div>
                <h1 className="auth-h1">One last step — verification</h1>
                <p className="auth-sub">Upload your {role.kyc.title.toLowerCase()}. We'll review it within 4 business hours and email you once your account is verified.</p>
              </div>

              <label className={"upload-card" + (uploaded ? " is-done" : "")} onClick={() => setUploaded(uploaded ? null : { name: "drug_license.pdf", size: "2.1 MB" })}>
                <div className="upload-card-left">
                  <div className="upload-card-ic">{React.createElement(Icons[role.kyc.icon] || Icons.Download, { size: 18, stroke: 1.7 })}</div>
                  <div>
                    <div className="upload-card-title">{uploaded ? uploaded.name : role.kyc.title}</div>
                    <div className="upload-card-sub">{uploaded ? "Uploaded · " + uploaded.size : role.kyc.sub}</div>
                  </div>
                </div>
                {uploaded ? <Icons.Check size={18} stroke={2.4} /> : <Icons.Plus size={16} stroke={2} />}
              </label>

              <div className="upload-card" style={{ cursor: "default" }}>
                <div className="upload-card-left">
                  <div className="upload-card-ic"><Icons.Hash size={18} stroke={1.7} /></div>
                  <div>
                    <div className="upload-card-title">PAN card (optional)</div>
                    <div className="upload-card-sub">Speeds up retailer credit approval</div>
                  </div>
                </div>
                <span className="kicker">SKIP</span>
              </div>

              <div className="pdp-trust-row">
                <div className="pdp-trust-item">
                  <Icons.ShieldCheck size={18} stroke={1.6} />
                  <div>
                    <strong>Encrypted upload</strong>
                    <span>TLS 1.3 in transit · AES-256 at rest</span>
                  </div>
                </div>
                <div className="pdp-trust-item">
                  <Icons.Calendar size={18} stroke={1.6} />
                  <div>
                    <strong>4-hour review</strong>
                    <span>You'll get email confirmation</span>
                  </div>
                </div>
              </div>

              <button onClick={finish} className="btn btn-primary btn-lg" style={{ justifyContent: "center" }} disabled={!uploaded || loading}>
                {loading ? <><span className="spinner" /> Submitting…</> : <>Submit for review <Icons.ArrowR size={14} stroke={2} /></>}
              </button>
              <button onClick={finish} className="btn btn-ghost" style={{ justifyContent: "center" }}>I'll do this later</button>
            </>
          )}

          {step > totalSteps && (
            <div className="auth-success">
              <div className="auth-success-ic"><Icons.Check size={32} stroke={2.6} /></div>
              <h1 className="auth-h1">{role.kyc ? "We've got your application" : "Welcome to nethrasap"}</h1>
              <p className="auth-sub">
                {role.kyc
                  ? "We'll review your credentials within 4 business hours. Meanwhile, you can browse the catalog with consumer pricing."
                  : "Your account is live. Same-day dispatch starts at 4 PM IST — let's get you set up."}
              </p>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <a href="/" className="btn btn-primary">Start browsing <Icons.ArrowR size={14} stroke={2} /></a>
                <a href="/categories" className="btn btn-outline">Explore categories</a>
              </div>
            </div>
          )}
        </div>
      </section>

      <AuthSide role={role} />
    </div>
  );
}

/* ----- FORGOT PASSWORD ----- */
function ForgotPage() {
  const [step, setStep] = aUS(1); // 1: email, 2: otp, 3: new password, 4: done
  const [email, setEmail] = aUS("");
  const [pw, setPw] = aUS("");
  const [showPw, setShowPw] = aUS(false);

  return (
    <div className="auth-shell">
      <section className="auth-form-pane">
        <div className="auth-form-pane-inner">
          <a className="auth-back" href="/login"><Icons.ArrowR size={13} stroke={2} style={{ transform: "rotate(180deg)" }} /> Back to sign in</a>

          {step === 1 && (
            <>
              <div>
                <h1 className="auth-h1">Reset your password</h1>
                <p className="auth-sub">Enter your registered email. We'll send a 6-digit code to confirm it's you.</p>
              </div>
              <form className="auth-form" onSubmit={(e) => { e.preventDefault(); setStep(2); }}>
                <div className="field">
                  <label className="field-label">Email</label>
                  <div className="input-affix">
                    <span className="input-affix-ic"><Icons.Mail size={15} stroke={1.7} /></span>
                    <input className="input" type="email" placeholder="you@pharmacy.in" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary btn-lg" style={{ justifyContent: "center" }}>Send code <Icons.ArrowR size={14} stroke={2} /></button>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h1 className="auth-h1">Check your inbox</h1>
                <p className="auth-sub">We sent a 6-digit code to <strong>{email || "your email"}</strong>. Enter it below — the code is valid for 5 minutes.</p>
              </div>
              <form className="auth-form" onSubmit={(e) => { e.preventDefault(); setStep(3); }}>
                <div className="field">
                  <label className="field-label">Verification code</label>
                  <OtpInput length={6} />
                  <div className="field-hint" style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                    <span>Code expires in 4:59</span>
                    <button type="button" onClick={() => setStep(1)} style={{ background: "none", border: "none", color: "var(--brand-700)", fontWeight: 500, fontSize: 12 }}>Resend</button>
                  </div>
                </div>
                <button type="submit" className="btn btn-primary btn-lg" style={{ justifyContent: "center" }}>Verify code <Icons.Check size={14} stroke={2.4} /></button>
              </form>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <h1 className="auth-h1">Set a new password</h1>
                <p className="auth-sub">Choose a password you haven't used before — 8+ characters with a mix of letters, numbers, and a symbol.</p>
              </div>
              <form className="auth-form" onSubmit={(e) => { e.preventDefault(); setStep(4); }}>
                <div className="field">
                  <label className="field-label">New password</label>
                  <div className="input-affix">
                    <span className="input-affix-ic"><Icons.ShieldCheck size={15} stroke={1.7} /></span>
                    <input className="input" type={showPw ? "text" : "password"} placeholder="Min 8 characters" value={pw} onChange={(e) => setPw(e.target.value)} required />
                    <button type="button" className="input-affix-toggle" onClick={() => setShowPw((v) => !v)} aria-label="Show password">
                      {showPw ? <Icons.X size={14} /> : <Icons.Sparkle size={14} />}
                    </button>
                  </div>
                  <div className={"pw-meter s" + pwStrength(pw)}><span /><span /><span /><span /></div>
                  <div className="pw-hint">{pwLabel(pwStrength(pw))}</div>
                </div>
                <div className="field">
                  <label className="field-label">Confirm new password</label>
                  <div className="input-affix">
                    <span className="input-affix-ic"><Icons.Check size={15} stroke={1.7} /></span>
                    <input className="input" type={showPw ? "text" : "password"} placeholder="Type it again" />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary btn-lg" style={{ justifyContent: "center" }} disabled={pwStrength(pw) < 2}>Save new password <Icons.ArrowR size={14} stroke={2} /></button>
              </form>
            </>
          )}

          {step === 4 && (
            <div className="auth-success">
              <div className="auth-success-ic"><Icons.Check size={32} stroke={2.6} /></div>
              <h1 className="auth-h1">Password updated</h1>
              <p className="auth-sub">All set — sign in with your new password to continue.</p>
              <a href="/login" className="btn btn-primary" style={{ marginTop: 8 }}>Sign in <Icons.ArrowR size={14} stroke={2} /></a>
            </div>
          )}
        </div>
      </section>

      <AuthSide role={ROLES[0]} alt="A safer ledger, a stronger password." />
    </div>
  );
}

if (typeof window !== "undefined") Object.assign(window, { LoginPage, SignupPage, ForgotPage });

/* ============== offline-page.jsx ============== */
/* ===========================================================
   OFFLINE PAGE
   =========================================================== */
const { useState: ofUS, useEffect: ofUE } = React;

function OfflinePage() {
  const [online, setOnline] = ofUS(typeof navigator !== "undefined" ? navigator.onLine : true);
  ofUE(() => {
    const u = () => setOnline(navigator.onLine);
    window.addEventListener("online", u);
    window.addEventListener("offline", u);
    return () => { window.removeEventListener("online", u); window.removeEventListener("offline", u); };
  }, []);

  const cached = [
    { label: "Home", href: "/" },
    { label: "Categories", href: "/categories" },
    { label: "Cart", href: "/cart" },
    { label: "Track an order", href: "/track-order" },
    { label: "Privacy policy", href: "/privacy" },
  ];

  return (
    <div className="container offline-page">
      <div className="offline-status">
        <span style={{ width: 8, height: 8, borderRadius: 999, background: online ? "var(--emerald)" : "var(--rose)", boxShadow: online ? "0 0 0 4px rgba(79, 107, 42, 0.25)" : "0 0 0 4px rgba(185, 72, 36, 0.25)" }} />
        <span className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-3)" }}>
          {online ? "Connection restored" : "You're offline"}
        </span>
      </div>

      <div className="offline-art">
        <span className="offline-art-wave" />
        <Icons.Snowflake size={56} stroke={1.4} />
      </div>

      <h1 className="offline-title">{online ? "You're back online." : "We can't reach our servers."}</h1>
      <p className="offline-desc">
        {online
          ? "Connection is good. Refresh the page or jump back to where you were heading."
          : "Some parts of the app may still work from your last visit. Once you're back online, your cart, recent orders and track-order links will sync automatically."}
      </p>

      <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap", justifyContent: "center" }}>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          <Icons.ArrowR size={14} stroke={2} style={{ transform: "rotate(180deg)" }} /> Try again
        </button>
        <a href="/" className="btn btn-outline">Go to homepage</a>
      </div>

      <div className="offline-cached">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="kicker">Cached pages</div>
          <span style={{ width: 1, height: 12, background: "var(--line)" }} />
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{cached.length} available offline</span>
        </div>
        <div className="offline-cached-list">
          {cached.map((c) => (
            <a key={c.href} href={c.href}>
              <span>{c.label}</span>
              <Icons.ArrowR size={13} stroke={1.7} />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

if (typeof window !== "undefined") (window as any).OfflinePage = OfflinePage;

/* ============== policy-page.jsx ============== */
/* ===========================================================
   POLICY PAGE — used by privacy / terms / refund
   =========================================================== */
const { useState: pgUS, useEffect: pgUE, useRef: pgUR } = React;

function PolicyPage({ kind }) {
  const policy = window.NETHRA_DATA.policies[kind];
  const [activeId, setActiveId] = pgUS(policy.sections[0].id);

  pgUE(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActiveId(e.target.id); });
    }, { rootMargin: "-30% 0px -60% 0px" });
    policy.sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [kind]);

  return (
    <>
      <Breadcrumbs items={[{ label: policy.title }]} />
      <div className="container">
        <div className="policy-layout">
          <aside className="policy-toc">
            <div className="policy-toc-h">On this page</div>
            <nav>
              {policy.sections.map((s) => (
                <a key={s.id} href={"#" + s.id} className={activeId === s.id ? "is-active" : ""}>{s.title}</a>
              ))}
            </nav>
            <div style={{ marginTop: 24, padding: 14, background: "var(--paper-2)", borderRadius: 10, fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.5 }}>
              Need a signed PDF copy for your compliance file? <a href="#" style={{ color: "var(--brand-700)", fontWeight: 500 }}>Request from legal</a>
            </div>
          </aside>

          <article className="policy-body">
            <header className="policy-header">
              <div className="kicker" style={{ color: "var(--brand-700)" }}>{policy.eyebrow}</div>
              <h1 className="policy-title" style={{ marginTop: 12 }}>{policy.title}</h1>
              <div className="policy-meta">
                <span><Icons.Calendar size={13} stroke={1.7} style={{ verticalAlign: "-2px", marginRight: 6 }} />{policy.updated}</span>
                <span style={{ width: 1, height: 14, background: "var(--line)", display: "inline-block" }} />
                <a href="#" style={{ color: "var(--ink-3)" }}><Icons.Download size={13} stroke={1.7} style={{ verticalAlign: "-2px", marginRight: 6 }} />Download PDF</a>
                <span style={{ width: 1, height: 14, background: "var(--line)", display: "inline-block" }} />
                <a href="#" onClick={(e) => { e.preventDefault(); window.print(); }} style={{ color: "var(--ink-3)" }}>Print</a>
              </div>
            </header>

            {policy.sections.map((s) => (
              <section key={s.id} id={s.id} className="policy-section">
                <h2>{s.title}</h2>
                <p>{s.body}</p>
              </section>
            ))}

            <div className="policy-actions">
              <a href="/privacy" className={"btn btn-sm " + (kind === "privacy" ? "btn-primary" : "btn-outline")}>Privacy</a>
              <a href="/terms" className={"btn btn-sm " + (kind === "terms" ? "btn-primary" : "btn-outline")}>Terms</a>
              <a href="/refund" className={"btn btn-sm " + (kind === "refund" ? "btn-primary" : "btn-outline")}>Refund</a>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}

if (typeof window !== "undefined") (window as any).PolicyPage = PolicyPage;

/* ============== extra-pages.jsx ============== */
/* ===========================================================
   EXTRA pages — detail screens, forms, special views
   needed to round out User / Sales / Manager / Admin / HR portals
   =========================================================== */
const { useState: xUS, useMemo: xUM } = React;

/* ===========================================================
   1. USER · Enquiry detail
   =========================================================== */
function UserEnquiryDetail() {
  const D = window.NETHRA_DATA;
  const id = window.getQuery("id") || D.enquiries[0].id;
  const enq = D.enquiries.find((e) => e.id === id) || D.enquiries[0];
  const [items, setItems] = xUS(enq.items.map((it) => ({ ...it })));
  const itemsResolved = items.map((it) => ({ ...it, p: window.findProduct(it.product_id) })).filter((x) => x.p);
  const subtotal = itemsResolved.reduce((s, it) => s + it.p.price_min * it.qty, 0);
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + tax;
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Enquiry {enq.id}</h1>
          <p className="portal-page-desc">Submitted {enq.placed_at} · sales rep {enq.sales_rep}</p>
        </div>
        <div className="portal-page-actions">
          <StatusPill status={enq.status} />
          {enq.status === "confirmed" && <a className="btn btn-primary" href="/checkout">Proceed to checkout <Icons.ArrowR size={13} stroke={2} /></a>}
          {enq.status === "pending" && <button className="btn btn-outline">Request quote</button>}
        </div>
      </div>

      <div className="portal-two-col">
        <Panel title="Line items" sub={enq.status === "pending" ? "Editable until quote is confirmed" : "Read-only"}>
          <div className="dtable-wrap">
            <table className="dtable">
              <thead><tr><th></th><th>Product</th><th>Qty</th><th className="num">Unit price</th><th className="num">Line total</th><th></th></tr></thead>
              <tbody>
                {itemsResolved.map((it) => (
                  <tr key={it.product_id}>
                    <td style={{ width: 56 }}><div style={{ width: 44, height: 44 }}><ProductTile product={it.p} size="sm" /></div></td>
                    <td><strong>{it.p.name}</strong><div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{it.p.brand}</div></td>
                    <td style={{ width: 120 }}>
                      {enq.status === "pending"
                        ? <Quantity value={it.qty} onChange={(q) => setItems((arr) => arr.map((x) => x.product_id === it.product_id ? { ...x, qty: q } : x))} />
                        : <span>{it.qty}</span>}
                    </td>
                    <td className="num">₹{it.p.price_min.toLocaleString("en-IN")}</td>
                    <td className="num">₹{(it.p.price_min * it.qty).toLocaleString("en-IN")}</td>
                    <td>
                      {enq.status === "pending" && (
                        <button className="icon-btn" aria-label="Remove" onClick={() => setItems((arr) => arr.filter((x) => x.product_id !== it.product_id))}>
                          <Icons.X size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Panel title="Estimated total">
            <div className="cart-summary-row"><span>Subtotal</span><span className="mono">₹{subtotal.toLocaleString("en-IN")}</span></div>
            <div className="cart-summary-row"><span>GST (5%)</span><span className="mono">₹{tax.toLocaleString("en-IN")}</span></div>
            <div className="cart-summary-row total"><span>Total</span><span className="mono">₹{total.toLocaleString("en-IN")}</span></div>
            <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 10 }}>Final price confirmed after checkout · prices subject to your role-based tier.</div>
          </Panel>
          <Panel title="Status timeline">
            <div className="confirm-timeline">
              {[
                { label: "Submitted", ts: enq.placed_at, done: true },
                { label: "Quote sent", ts: "—", done: enq.status === "confirmed" || enq.status === "checked_out" },
                { label: "Checked out", ts: "—", done: enq.status === "checked_out" },
              ].map((t, i, arr) => (
                <div key={i} className="confirm-tl-row">
                  <div className="confirm-tl-marker"><div className={"confirm-tl-dot" + (t.done ? " is-done" : "")} />{i < arr.length - 1 && <div className="confirm-tl-line" />}</div>
                  <div className="confirm-tl-body"><div className="confirm-tl-label">{t.label}</div><div className="confirm-tl-meta">{t.ts}</div></div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

/* ===========================================================
   2. SALES · Order detail (admin-grade)
   =========================================================== */
function SalesOrderDetail({ portal = "sales" }) {
  const D = window.NETHRA_DATA;
  const id = window.getQuery("id") || D.adminOrders[0].id;
  const order = D.adminOrders.find((o) => o.id === id) || D.adminOrders[0];
  const [tab, setTab] = xUS("items");
  const items = order.items.map((it) => ({ ...it, p: window.findProduct(it.product_id) })).filter((x) => x.p);
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Order {order.id}</h1>
          <p className="portal-page-desc">{order.customer.name} · placed {order.placed_at} · ₹{order.total.toLocaleString("en-IN")}</p>
        </div>
        <div className="portal-page-actions">
          <StatusPill status={order.status} />
          <select className="sort-select" style={{ height: 38 }} defaultValue={order.status}>
            <option value="placed">Placed</option><option value="confirmed">Confirmed</option>
            <option value="dispatched">Dispatched</option><option value="out_for_delivery">Out for delivery</option>
            <option value="delivered">Delivered</option><option value="cancelled">Cancelled</option>
          </select>
          <button className="btn btn-primary"><Icons.Mail size={13} stroke={2} /> Contact customer</button>
        </div>
      </div>

      <div className="tab-row">
        {[["items","Items"],["shipping","Shipping"],["payment","Payment"],["audit","Audit trail"]].concat(portal === "admin" ? [["refunds","Refunds"]] : []).map(([k, l]) => (
          <button key={k} className={"tab-row-item" + (tab === k ? " is-active" : "")} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === "items" && (
        <Panel>
          <div className="dtable-wrap">
            <table className="dtable">
              <thead><tr><th></th><th>Product</th><th>Qty</th><th className="num">Unit</th><th className="num">Line</th></tr></thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.product_id}>
                    <td style={{ width: 56 }}><div style={{ width: 44, height: 44 }}><ProductTile product={it.p} size="sm" /></div></td>
                    <td><strong>{it.p.name}</strong><div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{it.p.brand} · {it.p.unit_label}</div></td>
                    <td>{it.qty}</td>
                    <td className="num">₹{it.p.price_min.toLocaleString("en-IN")}</td>
                    <td className="num">₹{(it.p.price_min * it.qty).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 14, padding: 14, background: "var(--paper-3)", borderRadius: 10 }}>
            <div className="cart-summary-row"><span>Subtotal</span><span className="mono">₹{order.subtotal.toLocaleString("en-IN")}</span></div>
            <div className="cart-summary-row"><span>GST</span><span className="mono">₹{order.tax.toLocaleString("en-IN")}</span></div>
            <div className="cart-summary-row total"><span>Total</span><span className="mono">₹{order.total.toLocaleString("en-IN")}</span></div>
          </div>
        </Panel>
      )}

      {tab === "shipping" && (
        <div className="portal-two-col">
          <Panel title="Ship to">
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>
              <strong>{order.address.label}</strong><br />
              {order.address.line1}, {order.address.line2}<br />
              {order.address.city} {order.address.pin}, {order.address.state}<br />
              <span className="mono" style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{order.address.phone}</span>
            </div>
          </Panel>
          <Panel title="Tracking">
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
              <div><span style={{ color: "var(--ink-3)" }}>Carrier:</span> <strong>Delhivery</strong></div>
              <div><span style={{ color: "var(--ink-3)" }}>AWB:</span> <span className="mono">2840147219</span></div>
              <div><span style={{ color: "var(--ink-3)" }}>ETA:</span> <strong>{order.eta}</strong></div>
            </div>
            <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }}>Copy tracking link</button>
          </Panel>
        </div>
      )}

      {tab === "payment" && (
        <Panel title="Payment">
          <div className="dtable-wrap">
            <table className="dtable">
              <thead><tr><th>Method</th><th>Amount</th><th>Status</th><th>Reference</th></tr></thead>
              <tbody>
                <tr>
                  <td>{order.payment_method}</td>
                  <td className="num">₹{order.total.toLocaleString("en-IN")}</td>
                  <td><span className="pill pill-emerald">PAID</span></td>
                  <td className="mono" style={{ fontSize: 12 }}>RAZP_PMT_72A91XK</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {tab === "audit" && (
        <Panel title="Audit trail">
          <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            {[
              { ts: order.placed_at, who: "Customer", what: "Placed order" },
              { ts: "+2h", who: "Aarav Sharma", what: "Confirmed · added internal note: 'Priority dispatch'" },
              { ts: "+8h", who: "Warehouse · BHI-03", what: "Packed and dispatched" },
              { ts: "+18h", who: "Carrier", what: "Picked up · AWB 2840147219" },
            ].map((a, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "140px 200px 1fr", gap: 12, padding: "8px 0", borderBottom: "1px dashed var(--line)" }}>
                <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>{a.ts}</span>
                <span style={{ fontWeight: 500 }}>{a.who}</span>
                <span>{a.what}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {tab === "refunds" && portal === "admin" && (
        <Panel title="Refunds" action={<button className="btn btn-primary btn-sm">Process refund</button>}>
          <div style={{ color: "var(--ink-3)", fontSize: 13.5 }}>No refunds processed for this order.</div>
        </Panel>
      )}
    </>
  );
}
function AdminOrderDetail() { return <SalesOrderDetail portal="admin" />; }

/* ===========================================================
   3. SALES · Enquiry detail (with price editing)
   =========================================================== */
function SalesEnquiryDetail({ portal = "sales" }) {
  const D = window.NETHRA_DATA;
  const id = window.getQuery("id") || D.enquiries[0].id;
  const enq = D.enquiries.find((e) => e.id === id) || D.enquiries[0];
  const [items, setItems] = xUS(enq.items.map((it) => ({ ...it, suggested_price: window.findProduct(it.product_id)?.price_min || 0 })));
  const subtotal = items.reduce((s, it) => s + (it.suggested_price * it.qty), 0);
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + tax;
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Enquiry {enq.id}</h1>
          <p className="portal-page-desc">{enq.customer.name} · {enq.placed_at} · {enq.items.length} items</p>
        </div>
        <div className="portal-page-actions">
          <StatusPill status={enq.status} />
          {portal === "manager" && <button className="btn btn-outline btn-sm"><Icons.Users size={13} stroke={1.8} /> Reassign rep</button>}
        </div>
      </div>

      <div className="portal-two-col">
        <Panel title="Quote items" sub="Edit unit price per line, total recalculates">
          <div className="dtable-wrap">
            <table className="dtable">
              <thead><tr><th>Product</th><th>Qty</th><th className="num">Suggested unit</th><th className="num">Line total</th></tr></thead>
              <tbody>
                {items.map((it) => {
                  const p = window.findProduct(it.product_id);
                  if (!p) return null;
                  return (
                    <tr key={it.product_id}>
                      <td><strong>{p.name}</strong><div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{p.brand} · {p.unit_label}</div></td>
                      <td>{it.qty}</td>
                      <td className="num">
                        <input className="input mono" style={{ width: 110, textAlign: "right", height: 32 }} type="number"
                               value={it.suggested_price}
                               onChange={(e) => setItems((arr) => arr.map((x) => x.product_id === it.product_id ? { ...x, suggested_price: +e.target.value } : x))} />
                      </td>
                      <td className="num">₹{(it.suggested_price * it.qty).toLocaleString("en-IN")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Panel title="Customer">
            <div className="tcell-name">
              <div className="dtable-avatar">{enq.customer.name.split(" ").slice(0,2).map((x) => x[0]).join("").toUpperCase()}</div>
              <div>
                <strong>{enq.customer.name}</strong>
                <small>{enq.customer.email}</small>
              </div>
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
              <button className="btn btn-outline btn-sm" style={{ flex: 1, justifyContent: "center" }}><Icons.Mail size={13} stroke={1.8} /> Email</button>
              <button className="btn btn-outline btn-sm" style={{ flex: 1, justifyContent: "center" }}><Icons.Phone size={13} stroke={1.8} /> Call</button>
            </div>
          </Panel>
          <Panel title="Quote summary">
            <div className="cart-summary-row"><span>Subtotal</span><span className="mono">₹{subtotal.toLocaleString("en-IN")}</span></div>
            <div className="cart-summary-row"><span>GST (18%)</span><span className="mono">₹{tax.toLocaleString("en-IN")}</span></div>
            <div className="cart-summary-row total"><span>Total</span><span className="mono">₹{total.toLocaleString("en-IN")}</span></div>
          </Panel>
          <Panel title="Decision">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="btn btn-primary" style={{ justifyContent: "center" }}><Icons.Mail size={13} stroke={2} /> Send quote</button>
              <button className="btn btn-outline" style={{ justifyContent: "center" }}><Icons.Check size={13} stroke={2.4} /> Confirm enquiry</button>
              <button className="btn btn-outline" style={{ justifyContent: "center", color: "var(--rose)" }}><Icons.X size={13} stroke={2.2} /> Reject</button>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
function ManagerEnquiryDetail() { return <SalesEnquiryDetail portal="manager" />; }
function AdminEnquiryDetail() { return <SalesEnquiryDetail portal="admin" />; }

/* ===========================================================
   4. SALES · Verification detail
   =========================================================== */
function VerificationDetail() {
  const D = window.NETHRA_DATA;
  const id = window.getQuery("id") || D.verificationRequests[0].id;
  const v = D.verificationRequests.find((x) => x.id === id) || D.verificationRequests[0];
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Verification {v.id}</h1>
          <p className="portal-page-desc">{v.customer} · submitted {v.submitted}</p>
        </div>
        <div className="portal-page-actions"><StatusPill status={v.status} /></div>
      </div>

      <div className="portal-two-col">
        <Panel title="Document preview" sub={v.doc_type}>
          <div style={{
            position: "relative",
            aspectRatio: "8 / 11",
            background:
              "repeating-linear-gradient(135deg, var(--paper-3) 0 30px, var(--paper-2) 30px 60px)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--ink-3)",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            letterSpacing: "0.08em",
          }}>
            <div style={{ textAlign: "center" }}>
              <Icons.BadgeCheck size={48} stroke={1.4} />
              <div style={{ marginTop: 12 }}>{v.doc_type.toUpperCase()}</div>
              <div style={{ marginTop: 4, fontSize: 11 }}>{v.credential}</div>
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="btn btn-outline btn-sm"><Icons.Download size={13} stroke={2} /> Download</button>
            <button className="btn btn-outline btn-sm"><Icons.ExtLink size={13} stroke={2} /> Open externally</button>
          </div>
        </Panel>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Panel title="OCR-extracted fields" sub="Confidence: 92%">
            <dl className="modal-dl" style={{ marginBottom: 0 }}>
              <div><dt>Credential ID</dt><dd className="mono">{v.credential}</dd></div>
              <div><dt>Document type</dt><dd>{v.doc_type}</dd></div>
              <div><dt>Customer</dt><dd>{v.customer}</dd></div>
              <div><dt>Expires</dt><dd>{v.expires || "—"}</dd></div>
              <div><dt>Submitted</dt><dd>{v.submitted}</dd></div>
              <div><dt>Sales rep</dt><dd>{v.rep}</dd></div>
            </dl>
            <div style={{ marginTop: 12, padding: 12, background: "var(--paper-3)", borderRadius: 8, fontSize: 12.5, color: "var(--ink-3)" }}>
              <strong style={{ color: "var(--ink-2)" }}>Note:</strong> {v.notes}
            </div>
          </Panel>

          <Panel title="Decision">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="btn btn-primary"><Icons.Check size={14} stroke={2.4} /> Approve</button>
              <button className="btn btn-outline" style={{ color: "var(--rose)" }}><Icons.X size={14} stroke={2.2} /> Reject</button>
              <button className="btn btn-outline">Request more documents</button>
              <button className="btn btn-ghost"><Icons.Sparkle size={13} stroke={1.8} /> Flag for manual review</button>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

/* ===========================================================
   5. SALES · Product performance
   =========================================================== */
function SalesProductsPerformance() {
  const D = window.NETHRA_DATA;
  const top = D.products.slice().sort((a,b) => b.reviews - a.reviews).slice(0, 10);
  const max = top[0].reviews * top[0].price_max;
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Product performance</h1>
          <p className="portal-page-desc">Top-velocity SKUs across your customer book in the last 30 days.</p>
        </div>
        <select className="sort-select" style={{ height: 38 }}>
          <option>Last 30 days</option><option>Last 90 days</option><option>Year to date</option>
        </select>
      </div>

      <div className="kpi-grid">
        <KpiCard label="Units sold · 30d"  value="38,124" icon="Package" delta={9.4} kicker="vs prior" />
        <KpiCard label="Revenue · 30d"    value="₹42.1L" icon="Award" delta={14} kicker="vs prior" />
        <KpiCard label="Avg conversion"   value="22.8%"  icon="BadgeCheck" delta={1.2} kicker="vs prior" />
        <KpiCard label="Top category"     value="Rx"     icon="Pill" />
      </div>

      <div className="portal-two-col">
        <Panel title="Top 10 by revenue">
          {top.map((p) => (
            <BarRow key={p.id} name={p.name} value={p.reviews * p.price_max} max={max} format={(v) => "₹" + (v / 100000).toFixed(1) + "L"} />
          ))}
        </Panel>
        <Panel title="Category mix · 30d">
          <DonutChart data={D.categories.slice(0, 6).map((c, i) => ({
            label: c.name,
            value: Math.round((c.product_count * 100) + Math.random() * 800),
            color: ["var(--chart-1)","var(--chart-2)","var(--chart-4)","var(--chart-5)","var(--chart-3)","var(--chart-6)"][i],
          }))} />
        </Panel>
      </div>

      <Panel>
        <div className="dtable-wrap">
          <table className="dtable">
            <thead><tr><th>Product</th><th>Brand</th><th className="num">Units · 30d</th><th className="num">Revenue</th><th className="num">Conversion</th><th className="num">Rating</th></tr></thead>
            <tbody>
              {top.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td style={{ fontSize: 12 }}>{p.brand}</td>
                  <td className="num">{(Math.floor(Math.random() * 800) + 100).toLocaleString("en-IN")}</td>
                  <td className="num">₹{((p.reviews * p.price_max) / 100000).toFixed(1)}L</td>
                  <td className="num">{(15 + Math.random() * 18).toFixed(1)}%</td>
                  <td className="num">{p.rating.toFixed(1)} ★</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

/* ===========================================================
   6. SALES · Team (similar to manager-team, fewer cols)
   =========================================================== */
function SalesTeamSimple() {
  return <ManagerTeam />;
}

/* ===========================================================
   7. SALES · Reports
   =========================================================== */
function SalesReports() {
  const D = window.NETHRA_DATA;
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Reports</h1>
          <p className="portal-page-desc">Monthly snapshots across team, products, customers and the enquiry funnel.</p>
        </div>
        <div className="portal-page-actions">
          <select className="sort-select" style={{ height: 38 }}><option>May 2026</option><option>April 2026</option><option>March 2026</option></select>
          <button className="btn btn-outline btn-sm"><Icons.Download size={13} /> PDF</button>
          <button className="btn btn-outline btn-sm"><Icons.Download size={13} /> CSV</button>
        </div>
      </div>

      <Panel title="Monthly revenue summary" sub="By week">
        <LineChart data={D.revenueTrend.slice(0, 28)} height={220} />
      </Panel>

      <div className="portal-two-col">
        <Panel title="Team ranking · revenue">
          {D.salesTeam.map((t) => (
            <BarRow key={t.id} name={t.name} value={t.revenue} max={D.salesTeam[0].revenue} format={(v) => "₹" + (v/100000).toFixed(1) + "L"} />
          ))}
        </Panel>
        <Panel title="Enquiry ↑ order funnel">
          {[
            { label: "Initiated", value: 1240 },
            { label: "Confirmed", value: 920 },
            { label: "Checked out", value: 624 },
            { label: "Paid", value: 612 },
          ].map((f, i) => (
            <BarRow key={i} name={f.label} value={f.value} max={1240} format={(v) => v.toLocaleString("en-IN")} />
          ))}
          <div style={{ marginTop: 14, padding: 12, background: "var(--brand-50)", borderRadius: 10, fontSize: 12.5, color: "var(--ink-2)" }}>
            <strong>Overall conversion 49.4%</strong> · 30-day average. Top reason for drop-off: pending verification on schedule-H items.
          </div>
        </Panel>
      </div>
    </>
  );
}

/* ===========================================================
   8. MANAGER · Performance heatmap
   =========================================================== */
function ManagerPerformance() {
  const D = window.NETHRA_DATA;
  const team = D.salesTeam;
  const cats = D.categories.slice(0, 8);
  // synthesize a matrix
  function cell(repIdx, catIdx) {
    return Math.round((Math.sin((repIdx + 1) * (catIdx + 1)) * 0.5 + 0.5) * 80 + 20);
  }
  function color(v) {
    if (v > 80) return "var(--brand-700)";
    if (v > 60) return "var(--brand-400)";
    if (v > 40) return "var(--brand-300)";
    if (v > 20) return "var(--brand-100)";
    return "var(--paper-3)";
  }
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Performance analysis</h1>
          <p className="portal-page-desc">Heatmap of revenue contribution by rep × category — last 30 days.</p>
        </div>
        <button className="btn btn-outline btn-sm"><Icons.Download size={13} /> Export</button>
      </div>

      <Panel title="Rep × Category heatmap" sub="Darker olive = stronger contribution">
        <div className="heatmap">
          <div className="heatmap-h">Rep</div>
          {cats.map((c) => <div className="heatmap-h" key={c.id}>{c.sku}</div>)}
          {team.map((t, i) => (
            <React.Fragment key={t.id}>
              <div className="heatmap-name">{t.name}</div>
              {cats.map((c, j) => {
                const v = cell(i, j);
                return <div className="heatmap-c" key={c.id} style={{ background: color(v), color: v > 60 ? "var(--cream)" : "var(--ink)" }}>{v}</div>;
              })}
            </React.Fragment>
          ))}
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 14, fontSize: 12, color: "var(--ink-3)", flexWrap: "wrap" }}>
          {[20,40,60,80,100].map((v) => (
            <div key={v} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 14, height: 14, background: color(v), borderRadius: 3 }} />
              {v === 100 ? "≥80" : "≥" + (v - 20)}
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

/* ===========================================================
   9. MANAGER · Settings (preferences)
   =========================================================== */
function ManagerSettings() {
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">My preferences</h1>
          <p className="portal-page-desc">Notification, reporting and display settings — scoped to your manager account.</p>
        </div>
        <button className="btn btn-primary">Save changes</button>
      </div>

      <Panel title="Email notifications" sub="Choose what triggers an email to your inbox">
        {[
          ["orders","New orders > ₹50,000"],
          ["enquiries","Enquiry pending > 48h"],
          ["reports","Weekly performance report"],
          ["team_alerts","Team alerts (leave, miss-targets)"],
        ].map(([k, l]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
            <span style={{ fontSize: 13.5 }}>{l}</span>
            <label className="toggle"><input type="checkbox" defaultChecked /><span className="toggle-track" /><span className="toggle-thumb" /></label>
          </div>
        ))}
      </Panel>

      <Panel title="Report scheduling">
        <div className="auth-form-grid">
          <div className="field"><label className="field-label">Frequency</label>
            <select className="input"><option>Daily</option><option>Weekly</option><option>Monthly</option></select>
          </div>
          <div className="field"><label className="field-label">Recipients</label><input className="input" defaultValue="rohit@nethrasap.in, anika@nethrasap.in" /></div>
        </div>
      </Panel>

      <Panel title="Team defaults">
        <div className="auth-form-grid">
          <div className="field"><label className="field-label">Default revenue quota (₹/month)</label><input className="input" defaultValue="2000000" /></div>
          <div className="field"><label className="field-label">Target orders / month</label><input className="input" defaultValue="120" /></div>
        </div>
      </Panel>
    </>
  );
}

/* ===========================================================
   10. ADMIN · Product form (new / edit)
   =========================================================== */
function AdminProductForm({ mode = "new" }) {
  const D = window.NETHRA_DATA;
  const slug = window.getQuery("slug");
  const product = mode === "edit" ? (D.products.find((p) => p.slug === slug) || D.products[0]) : null;
  const [name, setName] = xUS(product?.name || "");
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">{mode === "new" ? "Create product" : "Edit product · " + product.name}</h1>
          <p className="portal-page-desc">{mode === "new" ? "Add a new SKU to the catalog with pricing, media, and visibility rules." : "Update specifications, pricing, and inventory."}</p>
        </div>
        <div className="portal-page-actions">
          <a href="/admin-products" className="btn btn-ghost">Cancel</a>
          {mode === "edit" && <button className="btn btn-outline btn-sm" style={{ color: "var(--rose)" }}><Icons.X size={13} /> Archive</button>}
          <button className="btn btn-primary">{mode === "new" ? "Create product" : "Save changes"}</button>
        </div>
      </div>

      <div className="portal-two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Panel title="Basic info">
            <div className="form-rows">
              <div className="auth-form-grid">
                <div className="field"><label className="field-label">SKU</label><input className="input mono" defaultValue={product?.id.toUpperCase() || ""} placeholder="RX-2401-A" /></div>
                <div className="field"><label className="field-label">Status</label>
                  <select className="input"><option>Active</option><option>Draft</option><option>Archived</option></select>
                </div>
              </div>
              <div className="field"><label className="field-label">Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Amoxicillin 500mg Capsules" /></div>
              <div className="field"><label className="field-label">Description</label><textarea className="textarea" defaultValue={product?.specs?.[0]?.value || ""} placeholder="Composition, dosage, indications…" /></div>
              <div className="auth-form-grid">
                <div className="field"><label className="field-label">Category</label>
                  <select className="input" defaultValue={product?.category_slug || ""}>{D.categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</select>
                </div>
                <div className="field"><label className="field-label">Brand</label>
                  <select className="input" defaultValue={product?.brand || ""}>{D.brands.map((b) => <option key={b}>{b}</option>)}</select>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Pricing">
            <div className="auth-form-grid">
              <div className="field"><label className="field-label">Min price (₹)</label><input className="input mono" type="number" defaultValue={product?.price_min || ""} /></div>
              <div className="field"><label className="field-label">Max price (₹)</label><input className="input mono" type="number" defaultValue={product?.price_max || ""} /></div>
            </div>
            <div className="kicker" style={{ marginTop: 14, marginBottom: 8 }}>Role-tier pricing</div>
            <div className="dtable-wrap">
              <table className="dtable">
                <thead><tr><th>Role</th><th className="num">Min</th><th className="num">Max</th></tr></thead>
                <tbody>
                  {["Customer","Clinician","Retailer"].map((r) => (
                    <tr key={r}>
                      <td><strong>{r}</strong></td>
                      <td><input className="input mono" type="number" style={{ height: 32, textAlign: "right" }} defaultValue={Math.round((product?.price_min || 100) * (r === "Retailer" ? 0.82 : r === "Clinician" ? 0.92 : 1))} /></td>
                      <td><input className="input mono" type="number" style={{ height: 32, textAlign: "right" }} defaultValue={Math.round((product?.price_max || 100) * (r === "Retailer" ? 0.82 : r === "Clinician" ? 0.92 : 1))} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Media" sub="Primary image and up to 8 gallery shots">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {[0,1,2,3].map((i) => (
                <div key={i} style={{ aspectRatio: 1, border: "1px dashed var(--line-2)", borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", fontSize: 12 }}>
                  {i === 0 && product
                    ? <ProductTile product={product} size="sm" />
                    : <><Icons.Plus size={20} stroke={1.6} /><span style={{ marginTop: 6 }}>{i === 0 ? "Primary" : "Gallery"}</span></>}
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Panel title="Visibility">
            <div className="form-rows">
              <label className="terms-check"><input type="checkbox" defaultChecked /><span className="filter-check-box"><Icons.Check size={10} stroke={3} /></span><span>Public on storefront</span></label>
              <div>
                <label className="field-label" style={{ display: "block", marginBottom: 8 }}>Visible to roles</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {["Customer","Clinician","Retailer"].map((r) => (
                    <label key={r} className="filter-check">
                      <input type="checkbox" defaultChecked /><span className="filter-check-box"><Icons.Check size={10} stroke={3} /></span><span>{r}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </Panel>
          <Panel title="Inventory">
            <div className="form-rows">
              <div className="field"><label className="field-label">Stock quantity</label><input className="input mono" type="number" defaultValue="248" /></div>
              <div className="field"><label className="field-label">Reorder point</label><input className="input mono" type="number" defaultValue="80" /></div>
            </div>
          </Panel>
          <Panel title="Compliance">
            <div className="form-rows">
              <div className="field"><label className="field-label">Schedule</label>
                <select className="input"><option>Non-scheduled</option><option>H</option><option>H1</option><option>X</option></select>
              </div>
              <div className="field"><label className="field-label">HSN code</label><input className="input mono" defaultValue={product?.hsn_code || ""} /></div>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
function AdminProductNew()  { return <AdminProductForm mode="new" />; }
function AdminProductEdit() { return <AdminProductForm mode="edit" />; }

/* ===========================================================
   11. ADMIN · Page editor
   =========================================================== */
function AdminPageEditor() {
  const [page, setPage] = xUS("home");
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Page editor</h1>
          <p className="portal-page-desc">Edit storefront content with a live preview pane on the right.</p>
        </div>
        <div className="portal-page-actions">
          <select className="sort-select" style={{ height: 38 }} value={page} onChange={(e) => setPage(e.target.value)}>
            <option value="home">Home</option><option value="about">About</option><option value="categories">Categories</option>
          </select>
          <label className="terms-check" style={{ alignSelf: "center", marginRight: 8 }}>
            <input type="checkbox" defaultChecked /><span className="filter-check-box"><Icons.Check size={10} stroke={3} /></span><span>Published</span>
          </label>
          <a className="btn btn-outline btn-sm" target="_blank" rel="noopener" href={page === "home" ? "index.html" : page + ".html"}><Icons.ExtLink size={13} /> View live</a>
          <button className="btn btn-primary">Save changes</button>
        </div>
      </div>

      <div className="portal-two-col">
        <Panel title="Editor" sub={"Editing: " + page + ".html"}>
          <div className="form-rows">
            <div className="field"><label className="field-label">Page title</label><input className="input" defaultValue="Nethrasap — India's audited healthcare supply platform" /></div>
            <div className="field"><label className="field-label">Meta description</label><textarea className="textarea" defaultValue="Verified manufacturers, bonded warehouses, transparent pricing — the supply backbone for India's pharmacies." /></div>
            <div className="field"><label className="field-label">Hero binding</label>
              <select className="input"><option>Active hero slides (3)</option><option>Static — single image</option></select>
            </div>
            <div className="field"><label className="field-label">Body sections (richtext)</label>
              <div className="textarea" style={{ minHeight: 200, padding: 0, overflow: "hidden" }}>
                <div style={{ display: "flex", gap: 4, padding: 8, borderBottom: "1px solid var(--line)" }}>
                  {["B","I","U","H₁","H₂"," ","—","•","1."].map((t, i) => (
                    <button key={i} className="icon-btn" style={{ width: 30, height: 28, fontSize: 12 }}>{t}</button>
                  ))}
                </div>
                <div style={{ padding: 14, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
                  Type your hero subhead, About copy, and CTA microcopy here. Use the toolbar to format and add headings…
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Preview" sub="Storefront with ?preview=true">
          <div style={{ aspectRatio: "10 / 13", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", background: "var(--paper-3)" }}>
            <iframe src={(page === "home" ? "index.html" : page + ".html") + "?preview=true"} style={{ width: "100%", height: "100%", border: 0, transform: "scale(0.62)", transformOrigin: "top left", width: "161%", height: "161%" }} title="Preview" />
          </div>
        </Panel>
      </div>
    </>
  );
}

/* ===========================================================
   12. HR · Attendance calendar
   =========================================================== */
function HrAttendance() {
  const D = window.NETHRA_DATA;
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  // synthesize attendance state
  function attState(empIdx, day) {
    if (day === 13 || day === 14) return "h"; // weekend example
    if (day > 16) return ""; // future
    const r = (empIdx + day) % 11;
    if (r === 0) return "a";
    if (r === 1) return "l";
    return "p";
  }
  return (
    <>
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Attendance · May 2026</h1>
          <p className="portal-page-desc">{D.employees.length} employees · attendance rate 94.6% this month.</p>
        </div>
        <div className="portal-page-actions">
          <select className="sort-select" style={{ height: 38 }}><option>May 2026</option><option>April 2026</option></select>
          <button className="btn btn-outline btn-sm">Mark all present today</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 4 }}>
        {[["p","Present","oklch(0.95 0.04 155)"],["a","Absent","var(--rose-bg)"],["l","Leave","var(--blue-bg)"],["h","Holiday","var(--paper-3)"]].map(([k, l, c]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-3)" }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: c }} />{l}
          </div>
        ))}
      </div>

      <Panel>
        <div style={{ overflowX: "auto" }}>
          <div className="calendar" style={{ minWidth: 1100 }}>
            <div className="calendar-h">Employee</div>
            {days.map((d) => <div className="calendar-h" key={d}>{d}</div>)}
            {D.employees.map((e, i) => (
              <React.Fragment key={e.id}>
                <div className="calendar-name">{e.name}</div>
                {days.map((d) => {
                  const s = attState(i, d);
                  return <div key={d} className={"calendar-cell" + (s ? " is-" + s : "")}>{s ? s.toUpperCase() : ""}</div>;
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </Panel>
    </>
  );
}

/* ===========================================================
   13. SYSTEM · Not found + Global error
   =========================================================== */
function NotFoundPage() {
  return (
    <div className="container offline-page" style={{ padding: "120px 24px" }}>
      <div className="offline-art"><Icons.Search size={56} stroke={1.4} /></div>
      <div className="kicker" style={{ marginBottom: 14 }}>404 · PAGE NOT FOUND</div>
      <h1 className="offline-title">We couldn't find that page.</h1>
      <p className="offline-desc">It may have been moved, renamed, or never existed. Try the catalog, your dashboard, or get in touch with support.</p>
      <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap", justifyContent: "center" }}>
        <a href="/" className="btn btn-primary">Go home <Icons.ArrowR size={14} stroke={2} /></a>
        <a href="/products" className="btn btn-outline">Browse catalog</a>
        <a href="/search" className="btn btn-ghost">Search</a>
      </div>
    </div>
  );
}

function GlobalErrorPage() {
  return (
    <div className="container offline-page" style={{ padding: "120px 24px" }}>
      <div className="offline-art" style={{ background: "var(--rose-bg)", borderColor: "var(--rose)", color: "var(--rose)" }}>
        <Icons.X size={56} stroke={1.6} />
      </div>
      <div className="kicker" style={{ marginBottom: 14, color: "var(--rose)" }}>500 · SOMETHING WENT WRONG</div>
      <h1 className="offline-title">An unexpected error occurred.</h1>
      <p className="offline-desc">We've logged it with our engineering team. Try refreshing the page, or reach out if it persists.</p>
      <div style={{ marginTop: 16, padding: "10px 14px", background: "var(--paper-3)", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-3)" }}>
        Trace ID: <strong>err_NS-2026-05-16-a8k29x</strong>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={() => window.location.reload()} className="btn btn-primary"><Icons.ArrowR size={14} stroke={2} style={{ transform: "rotate(180deg)" }} /> Try again</button>
        <a href="/" className="btn btn-outline">Go home</a>
      </div>
    </div>
  );
}

if (typeof window !== "undefined") Object.assign(window, {
  UserEnquiryDetail,
  SalesOrderDetail, AdminOrderDetail,
  SalesEnquiryDetail, ManagerEnquiryDetail, AdminEnquiryDetail,
  VerificationDetail,
  SalesProductsPerformance, SalesTeamSimple, SalesReports,
  ManagerPerformance, ManagerSettings,
  AdminProductNew, AdminProductEdit, AdminPageEditor,
  HrAttendance,
  NotFoundPage, GlobalErrorPage,
});

/* ============== exports ============== */
export {
  // shell.jsx
  PageShell, ToastHost, Footer, MobileBottomNav, Breadcrumbs, Logo,
  // product-card.jsx
  ProductCard,
  // chatbot.jsx
  ChatBot,
  // portal-shell.jsx
  PortalShell, KpiCard, Panel, StatusPill, BarRow, LineChart,
  // user-pages.jsx
  UserDashboard, UserProfile, UserAddresses, UserOrdersList, UserOrderDetail,
  UserEnquiries, UserEnquiryDetail, UserNotifications,
  // sales-pages.jsx
  SalesDashboard, SalesOrders, SalesOrderDetail, SalesEnquiriesList, SalesEnquiryDetail,
  SalesNotifications, SalesCustomers, SalesProductsPerformance, SalesReports,
  SalesTeamSimple, SalesVerifications,
  // manager-pages.jsx
  ManagerDashboard, ManagerAnalytics, ManagerPerformance, ManagerOrders,
  ManagerEnquiryDetail, ManagerTeam, ManagerSettings,
  // admin-pages.jsx
  AdminDashboard, AdminAnalytics, AdminProducts, AdminProductNew, AdminProductEdit,
  AdminCategories, AdminInventory, AdminOrders, AdminOrderDetail, AdminEnquiryDetail,
  AdminUsers, AdminRoles, AdminCms, AdminPageEditor, AdminSettings,
  // auth-pages.jsx
  LoginPage, SignupPage, ForgotPage,
  // offline-page.jsx
  OfflinePage,
  // policy-page.jsx
  PolicyPage,
  // extra-pages.jsx
  HrEmployees, HrAttendance, HrHolidays, HrLeave, HrPayroll,
  VerificationDetail, GlobalErrorPage, NotFoundPage,
};
