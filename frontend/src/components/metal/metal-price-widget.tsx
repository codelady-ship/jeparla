import { Landmark } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api, USING_MOCK } from "@/lib/api";
import { formatDecimal, formatPrice } from "@/lib/money";
import { alloyGramPrice, compareDecimal, percentChange } from "@/lib/pricing";
import type { MetalPrice, MetalType } from "@/types/api";
import { cn } from "cn";
import { ChangingValue } from "./changing-value";
import { PriceChart } from "./price-chart";

/** Gram prices people buy by (PLAN 5.10): gold 585/750/999, silver 925. */
const TILES: { metal: MetalType; fineness: number }[] = [
  { metal: "GOLD", fineness: 585 },
  { metal: "GOLD", fineness: 750 },
  { metal: "GOLD", fineness: 999 },
  { metal: "SILVER", fineness: 925 },
];
/** The chart follows the most common alloy. */
const CHART = { metal: "GOLD" as MetalType, fineness: 585 };

const day = (iso: string) => iso.slice(0, 10).split("-").reverse().join(".");
const dayMonth = (iso: string) => day(iso).slice(0, 5);

async function load(): Promise<{ latest: MetalPrice[]; history: MetalPrice[] } | null> {
  try {
    const [latest, history] = await Promise.all([
      api.latestMetalPrices(),
      api.metalPriceHistory(CHART.metal, 30),
    ]);
    return { latest, history };
  } catch {
    return null;
  }
}

/**
 * Daily CBAR metal prices with a 30-business-day chart (home page and product
 * page). Rendered on the server; only the small chart tooltip is client code.
 */
export async function MetalPriceWidget({
  headingLevel = 2,
  className,
}: {
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const [t, tp, locale, data] = await Promise.all([
    getTranslations("MetalPrices"),
    getTranslations("Product"),
    getLocale(),
    load(),
  ]);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const shell = (body: React.ReactNode) => (
    <section
      aria-labelledby="metal-prices"
      className={cn("flex flex-col gap-5 rounded-lg border bg-card p-5 sm:p-6", className)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Landmark aria-hidden className="size-5 text-gold-text" />
        <Heading id="metal-prices" className="text-2xl">
          {t("title")}
        </Heading>
        {/* Honesty rule: invented demo prices are labelled as such. */}
        {USING_MOCK && data && <Badge variant="secondary">{t("demoData")}</Badge>}
      </div>
      {body}
    </section>
  );

  if (!data) return shell(<p className="text-sm text-muted-foreground">{t("error")}</p>);
  const quote = (m: MetalType) => data.latest.find((p) => p.metal === m);
  const tiles = TILES.flatMap((tile) => {
    const q = quote(tile.metal);
    return q ? [{ ...tile, price: alloyGramPrice(q.pricePerGram, tile.fineness) }] : [];
  });
  if (tiles.length === 0)
    return shell(<p className="text-sm text-muted-foreground">{t("empty")}</p>);

  const date = (quote("GOLD") ?? data.latest[0]).date;
  const series = data.history.map((h) => ({
    date: h.date,
    price: alloyGramPrice(h.pricePerGram, CHART.fineness),
  }));
  const prices = series.map((s) => s.price);
  const money = (v: string) => formatPrice(v, locale);
  const byValue = [...prices].sort(compareDecimal);
  const change = series.length > 1 ? percentChange(prices[0], prices[prices.length - 1]) : null;
  const chartName = t("chartTitle", {
    metal: tp(`metal.${CHART.metal}`),
    fineness: CHART.fineness,
  });

  return shell(
    <>
      <p className="-mt-3 text-sm text-muted-foreground">
        {t("source")} <time dateTime={date}>{day(date)}</time>
      </p>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={`${tile.metal}-${tile.fineness}`} className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">
              {t("tile", { metal: tp(`metal.${tile.metal}`), fineness: tile.fineness })}
            </dt>
            <dd className="text-xl font-semibold tabular-nums sm:text-2xl">
              {/* Quiet transition only when the rate changed since this browser last saw it. */}
              <ChangingValue
                storageKey={`metal.${locale}.${tile.metal}-${tile.fineness}`}
                text={money(tile.price)}
              />
            </dd>
          </div>
        ))}
      </dl>

      {series.length > 1 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium">{chartName}</p>
            {change !== null && (
              <p className="text-sm text-muted-foreground tabular-nums">
                {t("change", {
                  value: `${change.startsWith("-") ? "−" : "+"}${formatDecimal(change.replace("-", ""), locale, { min: 1, max: 1 })}`,
                })}
              </p>
            )}
          </div>
          <div className="pt-10">
            <PriceChart
              points={series.map((s) => ({
                date: dayMonth(s.date),
                label: money(s.price),
                y: Number(s.price),
              }))}
              summary={t("chartSummary", {
                name: chartName,
                min: money(byValue[0]),
                max: money(byValue[byValue.length - 1]),
                last: money(prices[prices.length - 1]),
              })}
              maxLabel={money(byValue[byValue.length - 1])}
              minLabel={money(byValue[0])}
            />
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground underline-offset-4 hover:underline pointer-coarse:py-3">
              {t("table")}
            </summary>
            <div className="mt-2 max-h-64 overflow-y-auto rounded-md border">
              <table className="w-full">
                <caption className="sr-only">{chartName}</caption>
                <thead className="sticky top-0 bg-muted text-left">
                  <tr>
                    <th scope="col" className="px-3 py-1.5 font-medium">
                      {t("date")}
                    </th>
                    <th scope="col" className="px-3 py-1.5 text-right font-medium">
                      {t("perGram")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...series].reverse().map((s) => (
                    <tr key={s.date} className="border-t">
                      <td className="px-3 py-1.5 tabular-nums">{day(s.date)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{money(s.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{t("note")}</p>
    </>,
  );
}

export function MetalPriceSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex flex-col gap-5 rounded-lg border p-5 sm:p-6", className)}
      aria-busy="true"
    >
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
      <Skeleton className="h-40" />
    </div>
  );
}
