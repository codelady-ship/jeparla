import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ProductGridSkeleton } from "@/components/product/product-grid";
import { Catalog } from "@/components/catalog/catalog";
import { alternates } from "@/i18n/alternates";
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
  };
}

export default async function ProductsPage({ searchParams }: PageProps<"/[locale]/products">) {
  const t = await getTranslations("Catalog");
  return (
    <div className="container-page py-8 sm:py-12">
      <h1 className="mb-6 text-3xl sm:text-4xl">{t("title")}</h1>
      {/* Only the results depend on the query; the heading is part of the static shell. */}
      <Suspense fallback={<ProductGridSkeleton label={t("loading")} />}>
        <Catalog searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
