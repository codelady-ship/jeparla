import type { MetadataRoute } from "next";
import colors from "@/lib/brand-colors.json";

export type ManifestText = {
  description: string;
  catalog: string;
  search: string;
  favorites: string;
};

const ICONS: MetadataRoute.Manifest["icons"] = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

/**
 * Web app manifest for one language: the installed app opens in that language and its
 * shortcuts (long press on the icon) lead to the catalog, search and favorites.
 * One `id` for all languages, so the app counts as installed whichever one was used.
 * Colors come from the design tokens: the cream page background for the splash
 * screen and the title bar, as the site header uses it.
 */
export function buildManifest(locale: string, t: ManifestText): MetadataRoute.Manifest {
  const shortcut = (name: string, path: string) => ({
    name,
    url: `/${locale}${path}`,
    icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  });
  return {
    id: "/",
    name: "Jeparla",
    short_name: "Jeparla",
    description: t.description,
    lang: locale,
    dir: "ltr",
    start_url: `/${locale}`,
    scope: "/",
    display: "standalone",
    background_color: colors.light.bg,
    theme_color: colors.light.bg,
    categories: ["shopping", "lifestyle"],
    icons: ICONS,
    shortcuts: [
      shortcut(t.catalog, "/products"),
      shortcut(t.search, "/search"),
      shortcut(t.favorites, "/favorites"),
    ],
  };
}
