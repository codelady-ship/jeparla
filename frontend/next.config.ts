import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Server cache of backend reads (src/lib/api/live.ts), in line with the API's own CDN headers:
  // catalog s-maxage=300, metal prices s-maxage=3600 (backend/README.md). Seconds.
  cacheLife: {
    catalog: { stale: 60, revalidate: 300, expire: 86_400 },
    prices: { stale: 300, revalidate: 1_800, expire: 86_400 },
  },
  env: {
    // Version of the service worker (/sw.js): a new build is a new worker.
    JEPARLA_BUILD: (process.env.GITHUB_SHA ?? Date.now().toString(36)).slice(0, 12),
  },
  experimental: {
    // Root layout is app/[locale], so unmatched URLs need a standalone 404 page.
    globalNotFound: true,
  },
  partialPrefetching: true,
  // Pages opened from a link with a one-time token (#131): the URL never leaves in a Referer.
  async headers() {
    return ["reset-password", "verify-email"].map((page) => ({
      source: `/:locale(az|en|ru)/${page}`,
      headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
    }));
  },
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
