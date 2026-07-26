import Link from "next/link";

/** Single focused column. No split, no showcase — signing in is a task, and
 *  everything on screen should serve finishing it. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-page">
      {/* Ambient background: capsules + blister grid, drawn in CSS so there's
          no image request on the auth path. Purely decorative. */}
      <div className="auth-bg" aria-hidden="true">
        <span className="orb orb-1" />
        <span className="orb orb-2" />
        <span className="cap cap-1" />
        <span className="cap cap-2" />
        <span className="cap cap-3" />
      </div>

      <div className="auth-col">
        <Link href="/" className="logo auth-logo">
          Nethra<span>sap</span>
        </Link>

        {children}

        <p className="auth-trust">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 12l2 2 4-5M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7z" />
          </svg>
          GDP-compliant cold chain · CDSCO-verified sourcing
        </p>
      </div>
    </div>
  );
}
