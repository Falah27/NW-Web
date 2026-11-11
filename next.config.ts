import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  async redirects() {
    return [{ source: "/", destination: "/jobs", permanent: false }];
  },
  experimental: {
    agentFeedback: true,
    serverActions: {
      bodySizeLimit: "11mb",
    },
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
