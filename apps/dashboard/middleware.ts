import { type NextRequest, NextResponse } from "next/server";

/**
 * Edge middleware: auth gating + security headers for the ops dashboard.
 *
 * The gate reads the `nethra_auth` cookie — a plain, JS-readable role hint the
 * backend sets alongside the httpOnly `nethra_rt` refresh cookie. It is a UX
 * gate only: it stops unauthenticated visitors from being served the app
 * bundle and bounces non-staff to /login early. It is NOT a security boundary
 * — the cookie is client-forgeable, and the API (bearer tokens + server-side
 * permission checks) remains the sole enforcement layer.
 */

// Keep in sync with STAFF_ROLES in lib/auth.tsx (middleware runs on the edge
// and lib/auth.tsx is a client module, so the list is duplicated by design).
const STAFF_ROLES = ["sales", "manager", "admin"];

// 'unsafe-inline'/'unsafe-eval' are required by Next dev runtime and current
// inline styles. TODO(tighten): move to nonce/hash-based script-src and drop
// unsafe-eval for production builds.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' http://localhost:8000 ws://localhost:8000 https://*.nethrasap.com wss://*.nethrasap.com",
  "frame-ancestors 'none'",
].join("; ");

function withSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set("Content-Security-Policy", CSP);
  return res;
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // /login stays reachable; everything else behind the role-hint gate.
  if (pathname !== "/login") {
    const role = req.cookies.get("nethra_auth")?.value;
    if (!role) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("next", pathname + search);
      return withSecurityHeaders(NextResponse.redirect(url));
    }
    if (!STAFF_ROLES.includes(role)) {
      // A customer session reached the ops dashboard — send them back with a
      // reason the login page can surface.
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("error", "staff_only");
      return withSecurityHeaders(NextResponse.redirect(url));
    }
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  // Skip Next internals, favicons, and /api/* (the rewrite proxy to the
  // backend passes through untouched — the API sets its own headers).
  matcher: ["/((?!_next/|favicon|api/).*)"],
};
