/** @type {import('next').NextConfig} */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const nextConfig = {
  reactStrictMode: true,
  // gzip would hold back live SSE progress events behind the /api proxy.
  compress: false,
  experimental: {
    // Evaluations stream for many minutes; don't let the dev proxy cut them off.
    proxyTimeout: 3 * 60 * 60 * 1000,
  },
  // Proxy /api/* to the FastAPI backend so the browser talks same-origin in dev
  // and the X-OpenRouter-Key header is never exposed cross-origin.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_BASE}/:path*`,
      },
    ];
  },
};

export default nextConfig;
