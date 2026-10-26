import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Reduce build-time worker concurrency for shared hosting / LVE limits.
  experimental: {
    cpus: 1,
    staticGenerationMaxConcurrency: 1,
    staticGenerationMinPagesPerWorker: 1000,
    webpackMemoryOptimizations: true,
    serverSourceMaps: false,
  },

  productionBrowserSourceMaps: false,

  // The shop is exchange-only: the old returns pages moved, and links,
  // bookmarks and search results pointing at them land on the new pages.
  async redirects() {
    return [
      { source: "/returns", destination: "/exchange", permanent: true },
      { source: "/account/returns", destination: "/account/exchanges", permanent: true },
    ];
  },

  // Newly uploaded files are not part of Next's build-time public file list.
  // Serve all /uploads URLs via our Node disk route, including files uploaded
  // after the server starts. No external image host or storage provider.
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/uploads/:path*", destination: "/api/media/:path*" },
      ],
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
