import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @nethrasap/ui ships raw .tsx (shared auth fields) — Next must compile it.
  transpilePackages: ["@nethrasap/ui"],
  output: "standalone",
  experimental: { outputFileTracingRoot: repoRoot },
  async rewrites() {
    const api = process.env.API_PROXY_TARGET ?? "http://localhost:8000";
    return [{ source: "/api/v1/:path*", destination: `${api}/api/v1/:path*` }];
  },
};

export default nextConfig;
