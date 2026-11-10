import type { Metadata } from "next";
import { SITE_URL } from "@/i18n/alternates";
import type { Locale } from "@/i18n/routing";

type OpenGraph = NonNullable<Metadata["openGraph"]>;

/** Square brand mark (app/logo.png) for link previews of pages without their own picture. */
export const DEFAULT_OG_IMAGE = { url: "/logo.png", width: 512, height: 512, alt: "Jeparla" };

/**
 * Open Graph for one page, so a shared link previews that page (WhatsApp, Telegram,
 * Instagram, Facebook). A page's `openGraph` replaces the layout's completely in Next.js,
 * so every page passes its full set: its own URL, the site name, language and type.
 * og:title and og:description follow the page title and description unless `extra` sets them.
 */
export function openGraph(locale: Locale, path = "", extra: Partial<OpenGraph> = {}): OpenGraph {
  return {
    siteName: "Jeparla",
    locale,
    type: "website",
    url: `${SITE_URL}/${locale}${path === "/" ? "" : path}`,
    images: [DEFAULT_OG_IMAGE],
    ...extra,
  } as OpenGraph;
}
