import Link from "next/link";

export const metadata = { title: "Page not found" };

/* Branded 404 — rendered inside the normal shell for notFound() calls and any
   unmatched route. Points people at the two places they usually meant to go. */
export default function NotFound() {
  return (
    <div className="container section">
      <div className="empty">
        <span className="ic">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4-4M8.5 11h5" />
          </svg>
        </span>
        <h1 style={{ margin: 0, fontSize: "1.3rem" }}>We couldn&apos;t find that page</h1>
        <p className="muted" style={{ margin: 0, maxWidth: 440 }}>
          The link may be out of date, or the product may have been withdrawn
          from the catalogue. Everything we stock is a search away.
        </p>
        <div className="row" style={{ flexWrap: "wrap", justifyContent: "center", marginTop: 6 }}>
          <Link href="/products" className="btn btn-primary">
            Search the catalogue
          </Link>
          <Link href="/categories" className="btn btn-outline">
            Browse categories
          </Link>
          <Link href="/" className="btn btn-ghost">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
