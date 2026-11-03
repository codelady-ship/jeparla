import { describe, expect, it } from "vitest";
import type { PricingRule } from "@/types/api";
import { compareDecimal, gramPrice, metalLinkedPrice } from "./pricing";

const rule = (over: Partial<PricingRule> = {}): PricingRule => ({
  laborPerGram: "0",
  laborFixed: "0",
  stonePrice: "0",
  markupPercent: "0",
  minPrice: null,
  maxPrice: null,
  ...over,
});

describe("gramPrice", () => {
  it("divides the troy ounce price by 31.1034768", () => {
    expect(gramPrice("3110.34768")).toBe("100.0000");
    expect(gramPrice("7000.00")).toBe("225.0552");
  });
});

// Shared examples: the backend PricingEngine test (issue 7.2) uses the same table.
describe("metalLinkedPrice", () => {
  it("pure metal value: 3 g of 585 at 200 AZN/g = 351.00", () => {
    expect(
      metalLinkedPrice({ weightGrams: "3", fineness: 585, pureGramPrice: "200", rule: rule() }),
    ).toBe("351.00");
  });

  it("adds labor per gram, fixed labor, stone, then markup", () => {
    // metal 3.250 x 0.750 x 225.0547 = 548.570831...; labor 3.25x12 + 20 = 59; stone 400
    // (548.570831 + 59 + 400) x 1.15 = 1158.70645... -> 1158.71
    expect(
      metalLinkedPrice({
        weightGrams: "3.250",
        fineness: 750,
        pureGramPrice: "225.0547",
        rule: rule({
          laborPerGram: "12",
          laborFixed: "20",
          stonePrice: "400",
          markupPercent: "15",
        }),
      }),
    ).toBe("1158.71");
  });

  it("applies the seller's minimum and maximum", () => {
    const base = { weightGrams: "1", fineness: 585, pureGramPrice: "200" };
    expect(metalLinkedPrice({ ...base, rule: rule({ minPrice: "150.00" }) })).toBe("150.00");
    expect(metalLinkedPrice({ ...base, rule: rule({ maxPrice: "100.00" }) })).toBe("100.00");
  });

  it("rounds half up to cents and never uses floats", () => {
    // 0.1 g x 999/1000 x 0.15 = 0.014985 -> 0.01 ; 0.1+0.2 style errors would show here
    expect(
      metalLinkedPrice({ weightGrams: "0.1", fineness: 999, pureGramPrice: "0.15", rule: rule() }),
    ).toBe("0.01");
    expect(
      metalLinkedPrice({
        weightGrams: "1",
        fineness: 1000,
        pureGramPrice: "0.125",
        rule: rule({ laborFixed: "0.2" }),
      }),
    ).toBe("0.33");
  });
});

describe("compareDecimal", () => {
  it("compares decimal strings exactly", () => {
    expect(compareDecimal("10.10", "10.1")).toBe(0);
    expect(compareDecimal("9.99", "10")).toBe(-1);
    expect(compareDecimal("1000000000000.01", "1000000000000")).toBe(1);
  });
});
