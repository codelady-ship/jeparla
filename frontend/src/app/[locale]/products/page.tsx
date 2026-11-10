import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ProductGridSkeleton } from "@/components/product/product-grid";
import { Catalog } from "@/components/catalog/catalog";
import { ShareButton } from "@/components/share/share-button";
import { shareLabels } from "@/components/share/share-labels";
import { alternates } from "@/i18n/alternates";
import { openGraph } from "@/lib/seo/open-graph";
import { routing } from "@/i18n/routing";

export async function generateMetadata(): Promise<Metadata> {
  "use cache";
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Catalog" });
  return {
    title: t("title"),
    description: t("description"),
    // Filtered variants point to the unfiltered list as canonical.
    alternates: alternates(locale, "/products"),
    openGraph: openGraph(locale, "/products"),
  };
}

export default async function ProductsPage({ searchParams }: PageProps<"/[locale]/products">) {
  const [t, share] = await Promise.all([getTranslations("Catalog"), shareLabels()]);
  return (
    <div className="container-page py-8 sm:py-12">
      <div className="mb-6 flex items-start justify-between gap-4">
        <h1 className="min-w-0 text-3xl sm:text-4xl">{t("title")}</h1>
        {/* Shares the address bar at click time, so the current filters go along. */}
        <ShareButton labels={share} className="shrink-0" />
      </div>
      {/* Only the results depend on the query; the heading is part of the static shell. */}
      <Suspense fallback={<ProductGridSkeleton label={t("loading")} />}>
        <Catalog searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
