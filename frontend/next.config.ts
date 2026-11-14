import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  cacheComponents: true,
  env: {
    // Version of the service worker (/sw.js): a new build is a new worker.
    JEPARLA_BUILD: (process.env.GITHUB_SHA ?? Date.now().toString(36)).slice(0, 12),
  },
  experimental: {
    // Root layout is app/[locale], so unmatched URLs need a standalone 404 page.
    globalNotFound: true,
  },
  partialPrefetching: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
