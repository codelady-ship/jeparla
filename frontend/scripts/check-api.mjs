// Runs before `npm run build` (prebuild). A real-API build prerenders the public pages with
// catalog data (home sections, category lists, sitemap), so it needs the backend. Without one,
// `next build` would stop deep in prerendering with "GET /categories failed: 0"; this stops it
// first and names the way out. Any HTTP answer counts as reachable. Sample data builds
// (NEXT_PUBLIC_USE_MOCK=true: CI, demos) skip the check.
import nextEnv from "@next/env";

// The same .env files `next build` reads.
nextEnv.loadEnvConfig(process.cwd());

if (process.env.NEXT_PUBLIC_USE_MOCK !== "true") {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080").replace(/\/$/, "");
  try {
    await fetch(`${base}/api/v1/categories`, { signal: AbortSignal.timeout(10_000) });
  } catch {
    console.error(
      `The build reads the catalog from the API, but ${base} does not answer.\n` +
        "Start the backend (or set NEXT_PUBLIC_API_URL), or build with sample data:\n" +
        "  NEXT_PUBLIC_USE_MOCK=true npm run build",
    );
    process.exit(1);
  }
}
