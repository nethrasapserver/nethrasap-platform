import Link from "next/link";

/**
 * 404 — renders inside the root layout (CSS + fonts present) but outside the
 * portal chrome: no sidebar, just a centred card on the white console ground.
 */
export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--paper)", padding: "var(--sp-6)" }}>
      <div
        className="card pad"
        style={{ maxWidth: 440, width: "100%", display: "grid", justifyItems: "center", gap: 10, textAlign: "center" }}
      >
        <span
          aria-hidden="true"
          style={{ width: 44, height: 44, borderRadius: "var(--r-lg)", background: "var(--ice-100)", color: "var(--ice-600)", display: "grid", placeItems: "center" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35M8.5 11h5" />
          </svg>
        </span>
        <p className="eyebrow" style={{ margin: 0 }}>404</p>
        <h1 style={{ fontSize: "1.15rem", margin: 0 }}>Page not found</h1>
        <p className="muted small" style={{ margin: 0 }}>
          This page doesn&apos;t exist in the console — the link may be stale, or the record moved.
        </p>
        <Link href="/" className="btn btn-primary" style={{ marginTop: 6 }}>
          Back to overview
        </Link>
      </div>
    </main>
  );
}
