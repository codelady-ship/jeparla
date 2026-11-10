import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import type { ManifestText } from "./manifest";

/** Translated manifest strings for one locale (server only). */
export async function manifestText(locale: Locale): Promise<ManifestText> {
  const [meta, nav] = await Promise.all([
    getTranslations({ locale, namespace: "Metadata" }),
    getTranslations({ locale, namespace: "Nav" }),
  ]);
  return {
    description: meta("description"),
    catalog: nav("catalog"),
    search: nav("search"),
    favorites: nav("favorites"),
  };
}
