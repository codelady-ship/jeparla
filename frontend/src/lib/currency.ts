import Big from "big.js";
import { formatDecimal } from "@/lib/money";
import type { Decimal, DisplayCurrency, ExchangeRate } from "@/types/api";

/**
 * USD/EUR display of AZN prices (#53). Prices are stored and agreed in AZN; a converted price is an
 * approximation at the CBAR rate of the day and is always shown with "≈" and the rate date.
 * Exact decimal math (big.js), rounded half-up to cents; the value never becomes a float.
 */
export const DISPLAY_CURRENCIES: DisplayCurrency[] = ["USD", "EUR"];

const SYMBOL: Record<DisplayCurrency, string> = { USD: "$", EUR: "€" };
const NBSP = " ";

/** AZN amount / AZN per unit, rounded half-up to 2 places: "1700.00" at "1.7" gives "1000.00". */
export function convertFromAzn(amount: Decimal, aznPerUnit: Decimal): Decimal {
  const rate = new Big(aznPerUnit);
  if (rate.lte(0)) throw new RangeError(`Invalid rate ${aznPerUnit}`);
  return new Big(amount).div(rate).round(2, Big.roundHalfUp).toFixed(2);
}

/** "≈ $1,234.56" (en), "≈ 1.234,56 $" (az), "≈ 1 234,56 €" (ru). */
export function formatApprox(amount: Decimal, currency: DisplayCurrency, locale: string): string {
  const n = formatDecimal(amount, locale, { min: 2, max: 2 });
  return locale === "en"
    ? `≈${NBSP}${SYMBOL[currency]}${n}`
    : `≈${NBSP}${n}${NBSP}${SYMBOL[currency]}`;
}

/** The approximate price in each display currency that has a rate. */
export function approxPrices(
  amount: Decimal,
  rates: ExchangeRate[],
  locale: string,
): Partial<Record<DisplayCurrency, string>> {
  const out: Partial<Record<DisplayCurrency, string>> = {};
  for (const r of rates) {
    if (!DISPLAY_CURRENCIES.includes(r.currency)) continue;
    out[r.currency] = formatApprox(convertFromAzn(amount, r.aznPerUnit), r.currency, locale);
  }
  return out;
}
