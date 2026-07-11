"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";

export function Header() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  return (
    <header className="header">
      <div className="container">
        <Link href="/" className="logo">
          Nethra<span>sap</span>
        </Link>
        <nav className="nav-links grow">
          <Link href="/products">Products</Link>
          <Link href="/categories">Categories</Link>
          <Link href="/track">Track order</Link>
        </nav>
        <Link href="/cart" className="btn btn-outline btn-sm cart-btn" aria-label="Cart">
          Cart
          {count > 0 && <span className="cart-count">{count}</span>}
        </Link>
        {user ? (
          <div className="row" style={{ gap: 8 }}>
            <Link href="/account" className="btn btn-ghost btn-sm">
              {user.profile?.full_name ?? "Account"}
            </Link>
            <button className="btn btn-ghost btn-sm" onClick={logout}>
              Sign out
            </button>
          </div>
        ) : (
          <Link href="/login" className="btn btn-primary btn-sm">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div style={{ maxWidth: 280 }}>
          <div className="logo" style={{ marginBottom: 8 }}>
            Nethra<span>sap</span>
          </div>
          <p className="muted small">
            India&apos;s audited healthcare supply platform. GDP-compliant cold chain,
            CDSCO-verified sourcing.
          </p>
        </div>
        <div>
          <h4 className="small muted">Shop</h4>
          <div style={{ display: "grid", gap: 6 }} className="small">
            <Link href="/products">All products</Link>
            <Link href="/categories">Categories</Link>
            <Link href="/track">Track order</Link>
          </div>
        </div>
        <div>
          <h4 className="small muted">Account</h4>
          <div style={{ display: "grid", gap: 6 }} className="small">
            <Link href="/login">Sign in</Link>
            <Link href="/account">My orders</Link>
          </div>
        </div>
      </div>
      <div className="container small muted" style={{ paddingTop: 0, paddingBottom: 24 }}>
        © 2026 Nethrasap. For authorised buyers only. Not a substitute for professional medical advice.
      </div>
    </footer>
  );
}
