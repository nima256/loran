import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Newly uploaded files are not part of Next's build-time public file list.
  // Serve all /uploads URLs via our Node disk route, including files uploaded
  // after the server starts. No external image host or storage provider.
  async rewrites() {
    return {
      beforeFiles: [{ source: "/uploads/:path*", destination: "/api/media/:path*" }],
      afterFiles: [],
      fallback: [],
    };
  },
  images: {
    // Product photography is stored locally; no remote image host is needed.
    remotePatterns: [],
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
