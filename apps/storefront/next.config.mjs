/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
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
