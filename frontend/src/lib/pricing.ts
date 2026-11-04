import Big from "big.js";
import type { Decimal, PricingRule } from "@/types/api";

/** 1 troy ounce in grams (CBAR quotes metals per troy ounce). */
export const TROY_OUNCE_GRAMS = "31.1034768";

/** AZN per troy ounce -> AZN per gram, 4 decimals. */
export function gramPrice(pricePerOunce: Decimal): Decimal {
  return new Big(pricePerOunce).div(TROY_OUNCE_GRAMS).round(4, Big.roundHalfUp).toFixed(4);
}

export type PriceBreakdown = {
  /** weight x fineness/1000 x pure gram price */
  metal: Decimal;
  /** weight x laborPerGram + laborFixed */
  labor: Decimal;
  stone: Decimal;
  /** (metal + labor + stone) x markup% */
  markup: Decimal;
  /** Set when the seller's minimum or maximum changed the result. */
  clamped: "MIN" | "MAX" | null;
  total: Decimal;
};

/**
 * METAL_LINKED price (PLAN 5.10), exact decimal arithmetic:
 *   metal  = weight x (fineness / 1000) x gram price of pure metal
 *   labor  = weight x laborPerGram + laborFixed
 *   price  = (metal + labor + stone) x (1 + markup / 100)
 * then clamped to [minPrice, maxPrice] and rounded to 0.01 (half up).
 * The backend PricingEngine must give the same result for the same inputs;
 * the shared examples live in pricing.test.ts. The parts are rounded to cents
 * for display only; the total is computed from the unrounded values.
 */
export function metalLinkedBreakdown(input: {
  weightGrams: Decimal;
  fineness: number;
  pureGramPrice: Decimal;
  rule: PricingRule;
}): PriceBreakdown {
  const { weightGrams, fineness, pureGramPrice, rule } = input;
  const weight = new Big(weightGrams);
  const metal = weight.times(fineness).div(1000).times(pureGramPrice);
  const labor = weight.times(rule.laborPerGram).plus(rule.laborFixed);
  const base = metal.plus(labor).plus(rule.stonePrice);
  const raw = base.times(new Big(100).plus(rule.markupPercent).div(100));
  let price = raw;
  let clamped: PriceBreakdown["clamped"] = null;
  if (rule.minPrice !== null && price.lt(rule.minPrice)) {
    price = new Big(rule.minPrice);
    clamped = "MIN";
  }
  if (rule.maxPrice !== null && price.gt(rule.maxPrice)) {
    price = new Big(rule.maxPrice);
    clamped = "MAX";
  }
  const cents = (b: Big) => b.round(2, Big.roundHalfUp).toFixed(2);
  return {
    metal: cents(metal),
    labor: cents(labor),
    stone: cents(new Big(rule.stonePrice)),
    markup: cents(raw.minus(base)),
    clamped,
    total: cents(price),
  };
}

export function metalLinkedPrice(input: Parameters<typeof metalLinkedBreakdown>[0]): Decimal {
  return metalLinkedBreakdown(input).total;
}

/** Price per gram of an alloy: pure gram price x fineness / 1000, to cents. */
export function alloyGramPrice(pureGramPrice: Decimal, fineness: number): Decimal {
  return new Big(pureGramPrice).times(fineness).div(1000).round(2, Big.roundHalfUp).toFixed(2);
}

/** Percentage change from a to b, one decimal, e.g. "-1.2". */
export function percentChange(a: Decimal, b: Decimal): Decimal {
  if (new Big(a).eq(0)) return "0.0";
  return new Big(b).minus(a).div(a).times(100).round(1, Big.roundHalfUp).toFixed(1);
}

/** Compare two decimal strings: -1, 0, 1. */
export function compareDecimal(a: Decimal, b: Decimal): number {
  return new Big(a).cmp(b);
}
