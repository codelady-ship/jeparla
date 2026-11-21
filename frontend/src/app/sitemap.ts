import type { MetadataRoute } from "next";
import { LEGAL_DOCS, LEGAL_UPDATED } from "@/content/legal";
import { SITE_URL } from "@/i18n/alternates";
import { defaultLocale, locales } from "@/i18n/routing";
import { api, USING_MOCK } from "@/lib/api";
import { GUIDE_DATES, GUIDE_SLUGS, GUIDES_MODIFIED, guidePath } from "@/lib/guides";

/** Every public page in all three languages, each entry listing its translations. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, stores, categories, collections] = await Promise.all([
    api.listProducts({ size: 96 }),
    api.listStores(),
    api.listCategories(),
    // Optional section (#115): the sitemap never fails because of it.
    api.listCollections().catch(() => []),
  ]);

  const entry = (
    path: string,
    priority: number,
    lastModified?: string,
  ): MetadataRoute.Sitemap[number] => {
    const languages: Record<string, string> = {};
    for (const l of locales) languages[l] = `${SITE_URL}/${l}${path}`;
    languages["x-default"] = `${SITE_URL}/${defaultLocale}${path}`;
    return {
      url: `${SITE_URL}/${defaultLocale}${path}`,
      ...(lastModified && { lastModified }),
      priority,
      alternates: { languages },
    };
  };

  const pages = [
    entry("", 1),
    entry("/prices", 0.8),
    entry("/prices/monthly", 0.7),
    entry("/products", 0.9),
    entry("/categories", 0.8),
    entry("/stores", 0.8),
    entry("/verified", 0.5),
    entry("/size-guide", 0.6),
    entry("/calculator", 0.7),
    entry("/help", 0.5),
    entry("/about", 0.5),
    entry("/contact", 0.4),
    ...LEGAL_DOCS.map((doc) => entry(`/legal/${doc}`, 0.3, LEGAL_UPDATED)),
    ...categories.map((c) => entry(`/categories/${c.slug}`, 0.7)),
    // Occasion collections (#115): an empty one is an honest empty page, not listed.
    entry("/collections", 0.7),
    ...collections
      .filter((c) => c.productCount > 0)
      .map((c) => entry(`/collections/${c.slug}`, 0.7)),
    entry("/guides", 0.6, GUIDES_MODIFIED),
    ...GUIDE_SLUGS.map((s) => entry(guidePath(s), 0.6, GUIDE_DATES[s].modified)),
  ];
  // Demo stores and products are invented; they must not be indexed as real ones.
  if (USING_MOCK) return pages;
  return [
    ...pages,
    ...stores.map((s) => entry(`/stores/${s.slug}`, 0.7)),
    ...products.content.map((p) => entry(`/products/${p.slug}`, 0.6, p.publishedAt)),
  ];
}
