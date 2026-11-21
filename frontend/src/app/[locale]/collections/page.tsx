import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { CollectionLinks } from "@/components/collections/collection-links";
import { JsonLd } from "@/components/seo/json-ld";
import { alternates } from "@/i18n/alternates";
import { routing } from "@/i18n/routing";
import { api } from "@/lib/api";
import { breadcrumbs, itemList } from "@/lib/seo/json-ld";
import { openGraph } from "@/lib/seo/open-graph";

export async function generateMetadata(): Promise<Metadata> {
  "use cache";
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Collections" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: alternates(locale, "/collections"),
    openGraph: openGraph(locale, "/collections"),
  };
}

/** Occasion collections (#115): only those with products are offered. */
export default async function CollectionsPage() {
  const [t, locale, all] = await Promise.all([
    getTranslations("Collections"),
    getLocale(),
    // Before the API has collections (a frontend deployed first), the page says there are none.
    api.listCollections().catch(() => []),
  ]);
  const collections = all.filter((c) => c.productCount > 0);
  return (
    <div className="container-page py-8 sm:py-12">
      <JsonLd
        data={[
          breadcrumbs([{ name: t("title"), path: `/${locale}/collections` }]),
          itemList(
            t("title"),
            collections.map((c) => ({
              name: c.name[locale],
              path: `/${locale}/collections/${c.slug}`,
            })),
          ),
        ]}
      />
      <h1 className="mb-2 text-3xl sm:text-4xl">{t("title")}</h1>
      <p className="mb-2 max-w-2xl text-muted-foreground">{t("intro")}</p>
      <p className="mb-8 max-w-2xl text-sm text-muted-foreground">{t("source")}</p>
      {collections.length > 0 ? (
        <CollectionLinks collections={collections} label={t("title")} />
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-muted-foreground">
          {t("none")}
        </p>
      )}
    </div>
  );
}
