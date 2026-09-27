import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Product photography is local for now. When the backend ships, add the
    // media host here (e.g. { protocol: "https", hostname: "cdn.loranworld.com" }).
    remotePatterns: [],
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
