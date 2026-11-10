import type { MetadataRoute } from "next";
import { defaultLocale } from "@/i18n/routing";
import { buildManifest } from "@/lib/pwa/manifest";
import { manifestText } from "@/lib/pwa/manifest-text";

/**
 * /manifest.webmanifest in the default language, where tools look for it. Pages link
 * their own language's manifest (app/[locale]/manifest.webmanifest) from the layout.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  return buildManifest(defaultLocale, await manifestText(defaultLocale));
}
