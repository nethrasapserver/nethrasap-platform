import { type NextRequest, NextResponse } from "next/server";

/**
 * Edge middleware: security headers everywhere + a light auth gate on the
 * account-only pages. Guest flows (products, cart, checkout, track, compare)
 * are deliberately NOT gated.
 *
 * The gate reads the `nethra_auth` cookie — a plain, JS-readable role hint the
 * backend sets alongside the httpOnly `nethra_rt` refresh cookie. It is a UX
 * convenience only (redirect before serving the page); the API remains the
 * actual enforcement layer.
 */

// Routes that require a signed-in user. Prefix-matched.
const GATED_PREFIXES = ["/account", "/wishlist"];

// 'unsafe-inline'/'unsafe-eval' are required by Next dev runtime and current
// inline styles. TODO(tighten): move to nonce/hash-based script-src and drop
// unsafe-eval for production builds.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https: https://images.unsplash.com",
  "font-src 'self' data:",
  "connect-src 'self' http://localhost:8000 ws://localhost:8000 https://*.nethrasap.com wss://*.nethrasap.com",
  "frame-ancestors 'none'",
].join("; ");

function withSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set("Content-Security-Policy", CSP);
  return res;
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const gated = GATED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (gated && !req.cookies.get("nethra_auth")?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // The login page already honours ?next= (same-origin only).
    url.searchParams.set("next", pathname + search);
    return withSecurityHeaders(NextResponse.redirect(url));
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  // Skip Next internals, favicons, and /api/* (the rewrite proxy to the
  // backend passes through untouched — the API sets its own headers).
  matcher: ["/((?!_next/|favicon|api/).*)"],
};
