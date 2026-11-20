import type { NextConfig } from "next";

const API_PROXY_TARGET =
  process.env.API_PROXY_TARGET || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_PROXY_TARGET}/api/:path*` },
      { source: "/health", destination: `${API_PROXY_TARGET}/health` },
      { source: "/telegram-webhook", destination: `${API_PROXY_TARGET}/telegram-webhook` },
    ];
  },
};

export default nextConfig;
