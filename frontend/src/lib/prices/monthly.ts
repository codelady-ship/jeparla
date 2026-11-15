import Big from "big.js";
import { alloyGramPrice, percentChange } from "@/lib/pricing";
import type { Decimal, MetalPrice, MetalType } from "@/types/api";

/**
 * Monthly metal price overview (#63): only Jeparla's own stored CBAR quotes, nothing typed in
 * or estimated. A month lists what was quoted in it: the first and last quote, the lowest and
 * highest, the plain average of the quoted business days and the change from first to last.
 * Days without a quote (weekends, holidays) are not filled in.
 */
export type QuotePoint = { date: string; price: Decimal };

export type MonthSummary = {
  /** yyyy-MM */
  month: string;
  metal: MetalType;
  /** Prices are per gram of this fineness (1000 = the pure metal CBAR quotes), AZN, to cents. */
  fineness: number;
  quotes: number;
  first: QuotePoint;
  last: QuotePoint;
  low: QuotePoint;
  high: QuotePoint;
  /** Average of the quoted days, to cents. */
  average: Decimal;
  /** First to last quote, percent, one decimal. */
  change: Decimal;
  /** True when quotes were added by an admin correction rather than the CBAR bulletin. */
  corrected: boolean;
};

const PURE = 1000;

function gram(p: MetalPrice, fineness: number): Decimal {
  return fineness === PURE
    ? new Big(p.pricePerGram).round(2, Big.roundHalfUp).toFixed(2)
    : alloyGramPrice(p.pricePerGram, fineness);
}

/**
 * Summaries per month, newest month first, for one metal and fineness. One quote per date
 * (the latest fetched one wins, as the API keeps one per business date).
 */
export function monthlySummaries(
  history: MetalPrice[],
  metal: MetalType,
  fineness = PURE,
): MonthSummary[] {
  const byDate = new Map<string, MetalPrice>();
  for (const p of history) {
    if (p.metal !== metal) continue;
    const date = p.date.slice(0, 10);
    const seen = byDate.get(date);
    if (!seen || seen.fetchedAt < p.fetchedAt) byDate.set(date, p);
  }
  const months = new Map<string, { date: string; price: Decimal; admin: boolean }[]>();
  for (const [date, p] of [...byDate].sort(([a], [b]) => a.localeCompare(b))) {
    const month = date.slice(0, 7);
    const list = months.get(month) ?? [];
    list.push({ date, price: gram(p, fineness), admin: p.source === "ADMIN" });
    months.set(month, list);
  }
  return [...months]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, days]) => {
      const point = (d: (typeof days)[number]): QuotePoint => ({ date: d.date, price: d.price });
      let low = days[0];
      let high = days[0];
      let sum = new Big(0);
      for (const d of days) {
        if (new Big(d.price).lt(low.price)) low = d;
        if (new Big(d.price).gt(high.price)) high = d;
        sum = sum.plus(d.price);
      }
      const first = days[0];
      const last = days[days.length - 1];
      return {
        month,
        metal,
        fineness,
        quotes: days.length,
        first: point(first),
        last: point(last),
        low: point(low),
        high: point(high),
        average: sum.div(days.length).round(2, Big.roundHalfUp).toFixed(2),
        change: percentChange(first.price, last.price),
        corrected: days.some((d) => d.admin),
      };
    });
}
