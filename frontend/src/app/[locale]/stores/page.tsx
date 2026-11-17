import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AmbientVideo } from "@/components/media/ambient-video";
import { VITRINE_STORES } from "@/components/media/stock-media";
import { StoreList } from "@/components/stores/store-list";
import { Skeleton } from "@/components/ui/skeleton";
import { alternates } from "@/i18n/alternates";
import { openGraph } from "@/lib/seo/open-graph";
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
    openGraph: openGraph(locale, "/stores"),
  };
}

export default async function StoresPage({ searchParams }: PageProps<"/[locale]/stores">) {
  const t = await getTranslations("Stores");
  return (
    <div className="container-page py-8 sm:py-12">
      {/* Decorative showcase film (stock), never a listed store: the note below says so. */}
      <header className="mb-10">
        <div className="relative isolate flex min-h-[20rem] items-end overflow-hidden rounded-xl bg-scene-green text-scene-ivory sm:min-h-[24rem]">
          <AmbientVideo desktop={VITRINE_STORES.desktop} mobile={VITRINE_STORES.mobile} eager />
          <div aria-hidden className="scene-scrim absolute inset-0" />
          <div className="relative p-5 sm:p-8 md:max-w-2xl md:p-10">
            <h1 className="mb-3 text-4xl text-balance sm:text-5xl lg:text-6xl">{t("title")}</h1>
            <p className="max-w-xl text-pretty sm:text-lg">{t("intro")}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("decorNote")}</p>
      </header>
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
