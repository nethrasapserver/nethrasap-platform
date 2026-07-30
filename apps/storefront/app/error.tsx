"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";

/* Route-level error boundary. Server components on this segment (and below,
   where no closer boundary exists) throw into here instead of the framework's
   unstyled 500 — the shell (header, nav, footer) stays up around it. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Surface the real cause in the browser console / monitoring; the digest
    // below is what support can match against server logs.
    console.error(error);
  }, [error]);

  // reset() alone only re-renders the client segment — the failed server
  // fetch must be re-run too, hence router.refresh() in the same transition.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  return (
    <div className="container section">
      <div className="empty" role="alert">
        <span className="ic">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
          </svg>
        </span>
        <h1 style={{ margin: 0, fontSize: "1.3rem" }}>Something went wrong on our side</h1>
        <p className="muted" style={{ margin: 0, maxWidth: 440 }}>
          Sorry about that — the page hit a snag while loading. Your cart and
          account are safe. Trying again usually fixes it.
        </p>
        {error.digest && (
          <p className="small muted" style={{ margin: 0 }}>
            Reference: <span className="mono">{error.digest}</span>
          </p>
        )}
        <div className="row" style={{ flexWrap: "wrap", justifyContent: "center", marginTop: 6 }}>
          <button type="button" className="btn btn-primary" onClick={retry}>
            Try again
          </button>
          <Link href="/" className="btn btn-outline">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
