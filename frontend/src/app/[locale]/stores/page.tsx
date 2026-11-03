import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { StoreList } from "@/components/stores/store-list";
import { Skeleton } from "@/components/ui/skeleton";
import { alternates } from "@/i18n/alternates";
import { routing } from "@/i18n/routing";

export async function generateMetadata(): Promise<Metadata> {
  "use cache";
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Stores" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: alternates(locale, "/stores"),
  };
}

export default async function StoresPage({ searchParams }: PageProps<"/[locale]/stores">) {
  const t = await getTranslations("Stores");
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="mb-2 text-3xl sm:text-4xl">{t("title")}</h1>
      <p className="mb-8 max-w-2xl text-muted-foreground">{t("intro")}</p>
      <Suspense
        fallback={
          <ul
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-busy="true"
            aria-label={t("loading")}
          >
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i}>
                <Skeleton className="h-24 rounded-lg" />
              </li>
            ))}
          </ul>
        }
      >
        <StoreList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
