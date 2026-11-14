import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { defaultLocale } from "./src/i18n/routing";

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
  partialPrefetching: false,
  // Pages opened from a link with a one-time token (#131): the URL never leaves in a Referer.
  async headers() {
    return ["reset-password", "verify-email"].map((page) => ({
      source: `/:locale(az|en|ru)/${page}`,
      headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
    }));
  },
  async rewrites() {
    return {
      beforeFiles: [],
      // A first segment with a dot (/foo.php, /x.y/z) skips the locale proxy and is
      // never a language, so it would hit [locale] and get Next.js's English 404.
      // Real files and app routes (sitemap.xml, robots.txt, sw.js) are matched before
      // afterFiles, so only unknown paths move under the default language (#186).
      afterFiles: [
        {
          source: "/:first([^/]*\\.[^/]*)/:rest*",
          destination: `/${defaultLocale}/:first/:rest*`,
        },
      ],
      fallback: [],
    };
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
