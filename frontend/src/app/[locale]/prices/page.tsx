import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";
import { RelatedGuides } from "@/components/guides/related-guides";
import { MetalPriceWidget } from "@/components/metal/metal-price-widget";
import { JsonLd } from "@/components/seo/json-ld";
import { Badge } from "@/components/ui/badge";
import { alternates } from "@/i18n/alternates";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { api, USING_MOCK } from "@/lib/api";
import { formatPrice } from "@/lib/money";
import { alloyGramPrice, cbarUrl } from "@/lib/pricing";
import { breadcrumbs, webPage } from "@/lib/seo/json-ld";
import { openGraph } from "@/lib/seo/open-graph";
import type { Fineness, MetalPrice } from "@/types/api";

export async function generateMetadata(): Promise<Metadata> {
  "use cache";
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "PricesPage" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: alternates(locale, "/prices"),
    openGraph: openGraph(locale, "/prices"),
  };
}

async function load(): Promise<{ latest: MetalPrice[]; finenesses: Fineness[] } | null> {
  try {
    const [latest, finenesses] = await Promise.all([api.latestMetalPrices(), api.listFinenesses()]);
    return { latest, finenesses };
  } catch {
    return null;
  }
}

/**
 * Today's gram prices (issue #61, PLAN 5.18): original, quotable data for search and AI
 * answer engines. The heading and first paragraph answer "how much is a gram of 585 gold
 * today" directly; the table and the method follow, all in the initial HTML.
 */
export default async function PricesPage() {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return null;
  const [t, tm, tp, tn, format, data] = await Promise.all([
    getTranslations({ locale, namespace: "PricesPage" }),
    getTranslations({ locale, namespace: "MetalPrices" }),
    getTranslations({ locale, namespace: "Product" }),
    getTranslations({ locale, namespace: "Nav" }),
    getFormatter({ locale }),
    load(),
  ]);
  const quote = (m: Fineness["metal"]) => data?.latest.find((p) => p.metal === m);
  const rows = (data?.finenesses ?? []).flatMap((f) => {
    const q = quote(f.metal);
    return q ? [{ ...f, price: alloyGramPrice(q.pricePerGram, f.value) }] : [];
  });
  const gold = quote("GOLD");
  const date = (gold ?? data?.latest[0])?.date;
  const dateText = date
    ? format.dateTime(new Date(`${date.slice(0, 10)}T12:00:00Z`), "priceUpdated")
    : "";

  return (
    <div className="container-page flex max-w-4xl flex-col gap-10 py-8 sm:py-12">
      <JsonLd
        data={[
          webPage({
            locale,
            path: "/prices",
            name: t("title"),
            description: t("description"),
            ...(date && { dateModified: date.slice(0, 10) }),
          }),
          breadcrumbs([
            { name: tn("home"), path: `/${locale}` },
            { name: t("title"), path: `/${locale}/prices` },
          ]),
        ]}
      />
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl sm:text-4xl">{t("title")}</h1>
          {/* Honesty rule: invented demo prices are labelled as such. */}
          {USING_MOCK && rows.length > 0 && <Badge variant="secondary">{tm("demoData")}</Badge>}
        </div>
        {gold && date ? (
          <p className="max-w-2xl text-lg leading-relaxed">
            {t.rich("answer", {
              day: dateText,
              date: (chunks) => <time dateTime={date.slice(0, 10)}>{chunks}</time>,
              price: formatPrice(alloyGramPrice(gold.pricePerGram, 585), locale),
            })}
          </p>
        ) : (
          <p className="max-w-2xl text-muted-foreground">{data ? tm("empty") : tm("error")}</p>
        )}
      </header>

      {rows.length > 0 && date && (
        <section aria-labelledby="prices-table" className="flex flex-col gap-3">
          <h2 id="prices-table" className="text-2xl">
            {t("tableTitle")}
          </h2>
          <table className="w-full text-sm sm:text-base">
            <caption className="text-left text-sm text-muted-foreground">
              {t.rich("caption", {
                day: dateText,
                date: (chunks) => <time dateTime={date.slice(0, 10)}>{chunks}</time>,
              })}
            </caption>
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th scope="col" className="py-2 pr-4 font-normal">
                  {t("metal")}
                </th>
                <th scope="col" className="py-2 pr-4 font-normal">
                  {t("fineness")}
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  {t("perGram")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <th scope="row" className="py-2 pr-4 text-left font-medium">
                    {tp(`metal.${r.metal}`)}
                  </th>
                  <td className="py-2 pr-4 tabular-nums">{r.label}</td>
                  <td className="py-2 text-right font-semibold tabular-nums">
                    {formatPrice(r.price, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm text-muted-foreground">
            {t("source")}{" "}
            <a
              href={cbarUrl(date)}
              className="link-underline font-medium text-foreground"
              rel="noopener"
            >
              {t("sourceLink")}
            </a>
          </p>
        </section>
      )}

      <section aria-labelledby="prices-method" className="flex flex-col gap-3">
        <h2 id="prices-method" className="text-2xl">
          {t("methodTitle")}
        </h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5 leading-relaxed">
          {(["source", "gram", "fineness", "weekend", "jewelry"] as const).map((k) => (
            <li key={k}>{t(`method.${k}`)}</li>
          ))}
        </ol>
      </section>

      <div className="flex flex-col gap-3">
        <p>
          <Link href="/prices/monthly" className="link-underline font-medium">
            {t("monthlyLink")}
          </Link>
        </p>
        <RelatedGuides locale={locale} slugs={["gold-price-calculation", "fineness-chart"]} />
      </div>

      <MetalPriceWidget pricesLink={false} />
    </div>
  );
}
