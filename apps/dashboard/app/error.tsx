"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";

/**
 * Route error boundary — catches render/runtime errors in any segment below
 * the root layout (design-system CSS and Providers stay mounted, so portal
 * classes are safe here). reset() re-renders the failed segment.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Surface the real error for whoever is looking at the console.
    console.error(error);
  }, [error]);

  // Pair reset() with router.refresh() so any server-side state on the
  // segment is re-fetched too, not just the client render.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--paper)", padding: "var(--sp-6)" }}>
      <div
        role="alert"
        className="card pad"
        style={{ maxWidth: 440, width: "100%", display: "grid", justifyItems: "center", gap: 10, textAlign: "center" }}
      >
        <span
          aria-hidden="true"
          style={{ width: 44, height: 44, borderRadius: "var(--r-lg)", background: "var(--danger-bg)", color: "var(--danger)", display: "grid", placeItems: "center" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
          </svg>
        </span>
        <h1 style={{ fontSize: "1.15rem", margin: 0 }}>Something went wrong</h1>
        <p className="muted small" style={{ margin: 0 }}>
          An unexpected error stopped this page. Try again — if it keeps happening, tell the tech
          team what you were doing.
        </p>
        {error.digest && (
          <p className="muted small mono" style={{ margin: 0 }}>
            Ref: {error.digest}
          </p>
        )}
        <div className="row" style={{ justifyContent: "center", marginTop: 6 }}>
          <button type="button" className="btn btn-primary" onClick={retry}>
            Try again
          </button>
          <Link href="/" className="btn btn-ghost">
            Back to overview
          </Link>
        </div>
      </div>
    </main>
  );
}
