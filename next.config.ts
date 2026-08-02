import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: "/api/v1/ai/tutor/chat",
        destination: "/api/ai/tutor",
      },
      {
        source: "/api/v1/analytics/dashboard",
        destination: "/api/analytics",
      },
      {
        source: "/api/v1/:path*",
        destination: "/api/:path*",
      },
    ];
  },
};

export default nextConfig;
