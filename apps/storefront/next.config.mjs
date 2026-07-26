import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @nethrasap/ui ships raw .tsx (shared auth fields) — Next must compile it.
  transpilePackages: ["@nethrasap/ui"],
  trailingSlash: false,
  // Self-contained server bundle for Docker; tracing rooted at the monorepo
  // so workspace deps (@nethrasap/api-client) are included.
  output: "standalone",
  experimental: { outputFileTracingRoot: repoRoot },
  images: {
    remotePatterns: [
      // Product/category images are served from our own storage (Cloudflare R2)
      // via the API's presigned/public URLs. Add the bucket host once provisioned.
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async rewrites() {
    // Local dev convenience: proxy API calls to the FastAPI backend so the
    // browser talks same-origin. In production the storefront calls
    // NEXT_PUBLIC_API_BASE directly.
    const api = process.env.API_PROXY_TARGET ?? "http://localhost:8000";
    return [{ source: "/api/v1/:path*", destination: `${api}/api/v1/:path*` }];
  },
};

export default nextConfig;
