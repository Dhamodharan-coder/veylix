import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (see Dockerfile).
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  // Don't let `next dev` generate an AGENTS.md; project docs live in CLAUDE.md.
  agentRules: false,
  // Hide the floating Next.js "N" dev-tools button (errors still show as an overlay).
  devIndicators: false,
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
