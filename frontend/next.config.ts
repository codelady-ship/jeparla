import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { USING_MOCK } from "./src/lib/api/mode";
import { defaultLocale, routing } from "./src/i18n/routing";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Self-contained server for the production container (frontend/Dockerfile sets NEXT_OUTPUT).
  // Off elsewhere: `next start` (CI, Lighthouse) does not support standalone output.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
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
    const tokenPages = ["reset-password", "verify-email"].map((page) => ({
      source: `/:locale(az|en|ru)/${page}`,
      headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
    }));
    // Sample data is invented: a build on it is never indexed as real stores, products or
    // prices. A response header, not a robots meta tag: a tag from the layout would sit next
    // to the one Next.js writes on every 404 page and to the ones pages set themselves.
    const sampleData = USING_MOCK
      ? [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, follow" }] }]
      : [];
    return [...tokenPages, ...sampleData];
  },
  async rewrites() {
    return {
      beforeFiles: [],
      // A first segment with a dot (/foo.php, /x.y/z) skips the locale proxy and is
      // never a language, so it would hit [locale] and get Next.js's English 404.
      // Real files and app routes (sitemap.xml, robots.txt, sw.js) are matched before
      // afterFiles, so only unknown paths move under the default language (#186).
      afterFiles: [
        // IndexNow key file /<key>.txt (#62): the route answers only for the key in
        // JEPARLA_INDEXNOW_KEY (read per request), 404 otherwise. Real files come first.
        {
          source: "/:key([A-Za-z0-9-]{8,128})\\.txt",
          destination: "/api/indexnow-key/:key",
        },
        {
          source: "/:first([^/]*\\.[^/]*)/:rest*",
          destination: `/${defaultLocale}/:first/:rest*`,
        },
      ],
      // A path under a language that no route matches gets the prerendered 404 page of
      // that language (app/[locale]/404), like a missing product does in the proxy. A
      // catch-all page calling notFound() at request time made Next.js add a second
      // robots tag and fall back to client rendering.
      fallback: [
        {
          source: `/:locale(${routing.locales.join("|")})/:path*`,
          destination: "/:locale/404",
        },
      ],
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
