import Big from "big.js";
import type { Decimal, PricingRule } from "@/types/api";

/** 1 troy ounce in grams (CBAR quotes metals per troy ounce). */
export const TROY_OUNCE_GRAMS = "31.1034768";

/** AZN per troy ounce -> AZN per gram, 4 decimals. */
export function gramPrice(pricePerOunce: Decimal): Decimal {
  return new Big(pricePerOunce).div(TROY_OUNCE_GRAMS).round(4, Big.roundHalfUp).toFixed(4);
}

/**
 * METAL_LINKED price (PLAN 5.10), exact decimal arithmetic:
 *   metal  = weight x (fineness / 1000) x gram price of pure metal
 *   labor  = weight x laborPerGram + laborFixed
 *   price  = (metal + labor + stone) x (1 + markup / 100)
 * then clamped to [minPrice, maxPrice] and rounded to 0.01 (half up).
 * The backend PricingEngine must give the same result for the same inputs;
 * the shared examples live in pricing.test.ts.
 */
export function metalLinkedPrice(input: {
  weightGrams: Decimal;
  fineness: number;
  pureGramPrice: Decimal;
  rule: PricingRule;
}): Decimal {
  const { weightGrams, fineness, pureGramPrice, rule } = input;
  const weight = new Big(weightGrams);
  const metal = weight.times(fineness).div(1000).times(pureGramPrice);
  const labor = weight.times(rule.laborPerGram).plus(rule.laborFixed);
  let price = metal
    .plus(labor)
    .plus(rule.stonePrice)
    .times(new Big(100).plus(rule.markupPercent).div(100));
  if (rule.minPrice !== null && price.lt(rule.minPrice)) price = new Big(rule.minPrice);
  if (rule.maxPrice !== null && price.gt(rule.maxPrice)) price = new Big(rule.maxPrice);
  return price.round(2, Big.roundHalfUp).toFixed(2);
}

/** Compare two decimal strings: -1, 0, 1. */
export function compareDecimal(a: Decimal, b: Decimal): number {
  return new Big(a).cmp(b);
}
