"use client";

/**
 * Last-resort boundary — replaces the ROOT layout when it (or Providers)
 * throws, so no design-system CSS, fonts, or context exist here. Everything
 * is inline and hardcoded to the brand palette (styles.css tokens).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#ffffff",
          color: "#101208",
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          lineHeight: 1.5,
        }}
      >
        <div
          role="alert"
          style={{
            maxWidth: 440,
            width: "100%",
            textAlign: "center",
            display: "grid",
            justifyItems: "center",
            gap: 10,
            padding: 28,
            background: "#fbfbf7",
            border: "1px solid #e2e1d7",
            borderRadius: 14,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#fae3d8",
              color: "#b94824",
              display: "grid",
              placeItems: "center",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
            </svg>
          </span>
          <h1 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, letterSpacing: "-.02em" }}>
            Nethrasap Ops hit a problem
          </h1>
          <p style={{ margin: 0, fontSize: ".85rem", color: "#70746a" }}>
            The console could not start. Try again — if it keeps happening, tell the tech team.
          </p>
          {error.digest && (
            <p style={{ margin: 0, fontSize: ".8rem", color: "#70746a", fontFamily: "ui-monospace, monospace" }}>
              Ref: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 6,
              height: 38,
              padding: "0 18px",
              border: "none",
              borderRadius: 10,
              background: "#4f5a2e",
              color: "#fefae0",
              fontSize: ".88rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
