import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ProductGridSkeleton } from "@/components/product/product-grid";
import { alternates } from "@/i18n/alternates";
import { routing } from "@/i18n/routing";
import type { SearchParams } from "@/lib/catalog/filters";
import { SearchResults, tabPath, type SearchTab } from "./search-results";

/** Search result pages are thin by nature: crawl the links, keep them out of the index. */
export async function searchMetadata(tab: SearchTab): Promise<Metadata> {
  "use cache";
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "SearchPage" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: alternates(locale, tabPath(tab)),
    robots: { index: false, follow: true },
  };
}

export async function SearchPage({
  tab,
  searchParams,
}: {
  tab: SearchTab;
  searchParams: Promise<SearchParams>;
}) {
  const t = await getTranslations("SearchPage");
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="mb-6 text-3xl sm:text-4xl">{t("title")}</h1>
      <Suspense fallback={<ProductGridSkeleton label={t("loading")} />}>
        <SearchResults tab={tab} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
