import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // NOTE: static export removed on purpose — the dashboard needs a server
  // runtime for middleware-based auth/role guards and live data.
  trailingSlash: true,
  // Self-contained server bundle for Docker; tracing rooted at the monorepo.
  output: "standalone",
  experimental: { outputFileTracingRoot: repoRoot },
  // Temporary while pages are ported out of components/legacy.tsx (untyped,
  // auto-generated). Hand-written files are checked via `npm run typecheck`.
  // Remove both flags when legacy.tsx is gone.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async rewrites() {
    // Local dev: proxy API calls to the FastAPI backend (same-origin cookies).
    const api = process.env.API_PROXY_TARGET ?? "http://localhost:8000";
    return [{ source: "/api/v1/:path*", destination: `${api}/api/v1/:path*` }];
  },
};

export default nextConfig;
