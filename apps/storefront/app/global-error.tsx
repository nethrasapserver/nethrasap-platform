"use client";

/* Last-resort boundary: renders when the root layout itself throws, so it
   gets NO layout, NO global CSS and NO fonts. Everything is self-contained —
   inline styles with the olive brand tokens hardcoded (see packages/ui
   styles.css :root) and the system font stack as the Jakarta fallback. */

const page: React.CSSProperties = {
  margin: 0,
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 24,
  background: "#ffffff",
  color: "#101208",
  fontFamily:
    '"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  textAlign: "center",
};

const card: React.CSSProperties = {
  maxWidth: 460,
  padding: "40px 32px",
  border: "1.5px dashed #c9c6ba",
  borderRadius: 20,
  background: "#fbfbf7",
};

const button: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 20px",
  borderRadius: 999,
  border: "1px solid #4f5a2e",
  background: "#4f5a2e",
  color: "#fefae0",
  fontWeight: 600,
  fontSize: "0.9rem",
  cursor: "pointer",
  fontFamily: "inherit",
};

const ghost: React.CSSProperties = {
  ...button,
  background: "transparent",
  color: "#4f5a2e",
};

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={page}>
        <div style={card} role="alert">
          <div style={{ fontWeight: 800, fontSize: "1.25rem", color: "#3a4422", marginBottom: 8 }}>
            Nethra<span style={{ color: "#7e8a42" }}>sap</span>
          </div>
          <h1 style={{ margin: "0 0 8px", fontSize: "1.2rem" }}>Something went wrong</h1>
          <p style={{ margin: "0 0 6px", color: "#70746a", lineHeight: 1.55 }}>
            Sorry — the site hit an unexpected error. Your cart and account are
            safe. Please try again in a moment.
          </p>
          {error.digest && (
            <p style={{ margin: "0 0 6px", color: "#70746a", fontSize: "0.8rem" }}>
              Reference: <code>{error.digest}</code>
            </p>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 16 }}>
            <button type="button" style={button} onClick={() => reset()}>
              Try again
            </button>
            <a href="/" style={ghost}>
              Back to home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
