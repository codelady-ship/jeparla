import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { MetalCalculator, MetalCalculatorSkeleton } from "@/components/calculator/metal-calculator";
import { JsonLd } from "@/components/seo/json-ld";
import { alternates, SITE_URL } from "@/i18n/alternates";
import { routing, type Locale } from "@/i18n/routing";
import { faqPage, ORG_ID } from "@/lib/seo/json-ld";
import { openGraph } from "@/lib/seo/open-graph";

const PATH = "/calculator";
const FAQ_KEYS = ["price", "fineness", "source"] as const;

export async function generateMetadata(): Promise<Metadata> {
  "use cache";
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Calculator" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: alternates(locale, PATH),
    openGraph: openGraph(locale, PATH),
  };
}

/** Gold and silver calculator (#105): today's metal value from the CBAR rate. */
export default async function CalculatorPage({ searchParams }: PageProps<"/[locale]/calculator">) {
  const [t, locale] = await Promise.all([
    getTranslations("Calculator"),
    getLocale() as Promise<Locale>,
  ]);
  const faq = FAQ_KEYS.map((k) => ({ q: t(`faq.${k}.q`), a: t(`faq.${k}.a`) }));

  return (
    <div className="container-page py-8 sm:py-12">
      <JsonLd
        data={[
          {
            "@type": "WebApplication",
            "@id": `${SITE_URL}/${locale}${PATH}#app`,
            name: t("title"),
            description: t("description"),
            url: `${SITE_URL}/${locale}${PATH}`,
            inLanguage: locale,
            applicationCategory: "FinanceApplication",
            operatingSystem: "Any",
            browserRequirements: "Requires a web browser",
            isAccessibleForFree: true,
            offers: { "@type": "Offer", price: "0", priceCurrency: "AZN" },
            publisher: { "@id": ORG_ID },
          },
          faqPage(faq),
        ]}
      />
      <h1 className="mb-2 text-3xl sm:text-4xl">{t("title")}</h1>
      <p className="mb-8 max-w-2xl text-muted-foreground">{t("intro")}</p>

      <Suspense fallback={<MetalCalculatorSkeleton label={t("loading")} />}>
        <MetalCalculator searchParams={searchParams} />
      </Suspense>

      <section aria-labelledby="calc-how" className="mt-12 max-w-3xl">
        <h2 id="calc-how" className="mb-3 text-2xl">
          {t("howTitle")}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("howText")}</p>
      </section>

      <section aria-labelledby="calc-faq" className="mt-12 max-w-3xl">
        <h2 id="calc-faq" className="mb-4 text-2xl">
          {t("faqTitle")}
        </h2>
        <dl className="flex flex-col divide-y">
          {faq.map((item) => (
            <div key={item.q} className="py-4">
              <dt className="font-semibold">{item.q}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
