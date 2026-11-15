import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/seo/json-ld";
import { Badge } from "@/components/ui/badge";
import { alternates } from "@/i18n/alternates";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { api, USING_MOCK } from "@/lib/api";
import { formatPrice } from "@/lib/money";
import { monthlySummaries, type MonthSummary } from "@/lib/prices/monthly";
import { cbarUrl } from "@/lib/pricing";
import { breadcrumbs, webPage } from "@/lib/seo/json-ld";
import { openGraph } from "@/lib/seo/open-graph";
import type { MetalPrice, MetalType } from "@/types/api";

/** The longest history the API gives (MetalPriceController.MAX_DAYS). */
const HISTORY_DAYS = 366;
/** Rows of each month: the pure metal CBAR quotes and the common jewellery finenesses. */
const ROWS: { metal: MetalType; fineness: number }[] = [
  { metal: "GOLD", fineness: 1000 },
  { metal: "GOLD", fineness: 750 },
  { metal: "GOLD", fineness: 585 },
  { metal: "SILVER", fineness: 1000 },
  { metal: "SILVER", fineness: 925 },
];

export async function generateMetadata(): Promise<Metadata> {
  "use cache";
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "PricesMonthly" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: alternates(locale, "/prices/monthly"),
    openGraph: openGraph(locale, "/prices/monthly"),
  };
}

async function load(): Promise<MetalPrice[] | null> {
  try {
    const [gold, silver] = await Promise.all([
      api.metalPriceHistory("GOLD", HISTORY_DAYS),
      api.metalPriceHistory("SILVER", HISTORY_DAYS),
    ]);
    return [...gold, ...silver];
  } catch {
    return null;
  }
}

/** yyyy-MM-dd as a date at noon UTC, so no time zone moves it to another day. */
const noon = (isoDay: string) => new Date(`${isoDay}T12:00:00Z`);

/**
 * Monthly overview of gold and silver prices in Azerbaijan (#63, PLAN 5.18): original data
 * from Jeparla's own stored CBAR quotes, for search and AI answer engines. Every number is
 * computed from the stored history; a month without quotes does not appear.
 */
export default async function MonthlyPricesPage() {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return null;
  const [t, tp, tn, tpp, format, history] = await Promise.all([
    getTranslations({ locale, namespace: "PricesMonthly" }),
    getTranslations({ locale, namespace: "Product" }),
    getTranslations({ locale, namespace: "Nav" }),
    getTranslations({ locale, namespace: "PricesPage" }),
    getFormatter({ locale }),
    load(),
  ]);
  const byKey = new Map<string, MonthSummary>();
  for (const r of ROWS)
    for (const s of monthlySummaries(history ?? [], r.metal, r.fineness))
      byKey.set(`${s.month}|${r.metal}|${r.fineness}`, s);
  const months = [...new Set([...byKey.values()].map((s) => s.month))].sort().reverse();
  const latest = [...byKey.values()]
    .map((s) => s.last.date)
    .sort()
    .at(-1);
  const day = (iso: string) => format.dateTime(noon(iso), "priceUpdated");
  const monthName = (m: string) =>
    format.dateTime(noon(`${m}-15`), { month: "long", year: "numeric", timeZone: "UTC" });
  const price = (v: string) => formatPrice(v, locale);
  const pct = (v: string) => `${Number(v) > 0 ? "+" : ""}${format.number(Number(v))}%`;
  const label = (metal: MetalType, fineness: number) =>
    `${tp(`metal.${metal}`)} ${fineness === 1000 ? t("pure") : fineness}`;

  return (
    <div className="container-page flex max-w-5xl flex-col gap-10 py-8 sm:py-12">
      <JsonLd
        data={[
          webPage({
            locale,
            path: "/prices/monthly",
            name: t("title"),
            description: t("description"),
            ...(latest && { dateModified: latest }),
          }),
          breadcrumbs([
            { name: tn("home"), path: `/${locale}` },
            { name: tpp("title"), path: `/${locale}/prices` },
            { name: t("title"), path: `/${locale}/prices/monthly` },
          ]),
        ]}
      />
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl sm:text-4xl">{t("title")}</h1>
          {USING_MOCK && months.length > 0 && <Badge variant="secondary">{t("demoData")}</Badge>}
        </div>
        <p className="max-w-2xl text-lg leading-relaxed">{t("lead")}</p>
        <p className="text-sm text-muted-foreground">
          <Link href="/prices" className="link-underline font-medium text-foreground">
            {t("today")}
          </Link>
        </p>
      </header>

      {history === null && <p className="text-muted-foreground">{t("error")}</p>}
      {history !== null && months.length === 0 && (
        <p className="text-muted-foreground">{t("empty")}</p>
      )}

      {months.map((m) => {
        const gold = byKey.get(`${m}|GOLD|585`);
        const id = `month-${m}`;
        return (
          <section key={m} aria-labelledby={id} className="flex flex-col gap-3">
            <h2 id={id} className="text-2xl">
              <time dateTime={m}>{monthName(m)}</time>
            </h2>
            {gold && (
              <p className="max-w-3xl leading-relaxed">
                {t.rich("summary", {
                  firstDay: day(gold.first.date),
                  lastDay: day(gold.last.date),
                  first: price(gold.first.price),
                  last: price(gold.last.price),
                  low: price(gold.low.price),
                  high: price(gold.high.price),
                  change: pct(gold.change),
                  quotes: gold.quotes,
                  d1: (c) => <time dateTime={gold.first.date}>{c}</time>,
                  d2: (c) => <time dateTime={gold.last.date}>{c}</time>,
                })}
              </p>
            )}
            <div className="-mx-4 overflow-x-auto px-4">
              <table className="w-full min-w-[40rem] text-sm">
                <caption className="text-left text-sm text-muted-foreground">
                  {t("caption")}
                </caption>
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    {(["metal", "first", "last", "low", "high", "average", "change"] as const).map(
                      (c) => (
                        <th
                          key={c}
                          scope="col"
                          className={
                            c === "metal"
                              ? "py-2 pr-4 font-normal"
                              : "py-2 pl-3 text-right font-normal"
                          }
                        >
                          {t(`col.${c}`)}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((r) => {
                    const s = byKey.get(`${m}|${r.metal}|${r.fineness}`);
                    if (!s) return null;
                    return (
                      <tr key={`${r.metal}${r.fineness}`} className="border-b last:border-0">
                        <th scope="row" className="py-2 pr-4 text-left font-medium">
                          {label(r.metal, r.fineness)}
                          {s.corrected && <sup className="pl-0.5 text-muted-foreground">*</sup>}
                        </th>
                        <td className="py-2 pl-3 text-right tabular-nums">
                          {price(s.first.price)}
                        </td>
                        <td className="py-2 pl-3 text-right tabular-nums">{price(s.last.price)}</td>
                        <td className="py-2 pl-3 text-right tabular-nums">{price(s.low.price)}</td>
                        <td className="py-2 pl-3 text-right tabular-nums">{price(s.high.price)}</td>
                        <td className="py-2 pl-3 text-right tabular-nums">{price(s.average)}</td>
                        <td className="py-2 pl-3 text-right tabular-nums">{pct(s.change)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {gold && (
              <p className="text-xs text-muted-foreground">
                {t("quotes", { count: gold.quotes })}{" "}
                <a
                  href={cbarUrl(gold.last.date)}
                  className="link-underline font-medium text-foreground"
                  rel="noopener"
                >
                  {t("sourceLink", { day: day(gold.last.date) })}
                </a>
              </p>
            )}
          </section>
        );
      })}

      <section aria-labelledby="monthly-method" className="flex flex-col gap-3">
        <h2 id="monthly-method" className="text-2xl">
          {t("methodTitle")}
        </h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 leading-relaxed">
          {(["source", "stats", "gaps", "corrected", "jewelry"] as const).map((k) => (
            <li key={k}>{t(`method.${k}`)}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
