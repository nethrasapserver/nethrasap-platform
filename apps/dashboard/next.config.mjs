/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // NOTE: static export removed on purpose — the dashboard needs a server
  // runtime for middleware-based auth/role guards and live data.
  trailingSlash: true,
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
