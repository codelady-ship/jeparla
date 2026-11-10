import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { IntlProvider } from "@/components/i18n/intl-provider";
import { SellerWizard } from "@/components/sell/seller-wizard";
import { Skeleton } from "@/components/ui/skeleton";
import { alternates } from "@/i18n/alternates";
import { openGraph } from "@/lib/seo/open-graph";
import { routing } from "@/i18n/routing";
import { api } from "@/lib/api";

export async function generateMetadata(): Promise<Metadata> {
  "use cache";
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Sell" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: alternates(locale, "/sell"),
    openGraph: openGraph(locale, "/sell"),
  };
}

export default async function SellPage() {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return null;
  const [t, m, categories, finenesses] = await Promise.all([
    getTranslations({ locale, namespace: "Sell" }),
    getMessages({ locale }),
    api.listCategories(),
    api.listFinenesses(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl sm:text-4xl">{t("title")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("intro")}</p>
      </div>
      <IntlProvider
        locale={locale}
        messages={{ Common: m.Common, Errors: m.Errors, Sell: m.Sell, Auth: m.Auth }}
      >
        {/* The wizard reads ?step=, so it renders on the client inside Suspense. */}
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
          <SellerWizard
            categories={categories
              .filter((c) => c.parentId === null)
              .map((c) => ({ value: c.slug, label: c.name[locale] }))}
            finenesses={finenesses.map((f) => ({ value: String(f.id), label: f.label }))}
          />
        </Suspense>
      </IntlProvider>
    </div>
  );
}
