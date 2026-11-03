import type { Metadata } from "next";
import { defaultLocale, locales, type Locale } from "./routing";

/**
 * Public origin for canonical, hreflang, sitemap and structured data. Order: explicit
 * NEXT_PUBLIC_SITE_URL, then Vercel's production domain (Vercel sets it at build time),
 * then localhost for development. Search engines ignore pages whose canonical points
 * to localhost, so production must never fall through to it.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
).replace(/\/$/, "");

/** canonical + hreflang links for a path without locale prefix, e.g. "/products". */
export function alternates(locale: Locale, path = ""): Metadata["alternates"] {
  const clean = path === "/" ? "" : path;
  const languages: Record<string, string> = {};
  for (const l of locales) languages[l] = `${SITE_URL}/${l}${clean}`;
  languages["x-default"] = `${SITE_URL}/${defaultLocale}${clean}`;
  return { canonical: `${SITE_URL}/${locale}${clean}`, languages };
}
