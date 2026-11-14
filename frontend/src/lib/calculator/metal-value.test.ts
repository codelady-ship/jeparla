import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { alloyGramPrice as bigAlloyGramPrice, metalLinkedPrice } from "@/lib/pricing";
import type { Fineness } from "@/types/api";
import {
  alloyGramPrice,
  buildOptions,
  FALLBACK_FINENESSES,
  metalValue,
  parseWeight,
  selectionFromParams,
  toQuery,
} from "./metal-value";

type LinkedCase = {
  name: string;
  weightGrams: string;
  fineness: number;
  pureGramPrice: string;
  rule: Record<string, string | null>;
  breakdown: { metal: string; total: string };
};

// Parity table shared with the backend PricingEngine (#44): the same inputs must give the same cents.
const cases: { linked: LinkedCase[] } = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../../../../backend/src/test/resources/pricing/pricing-cases.json"),
    "utf8",
  ),
);

describe("metalValue", () => {
  it("matches the backend PricingEngine metal part for every shared case", () => {
    expect(cases.linked.length).toBeGreaterThan(100);
    for (const c of cases.linked) {
      expect(metalValue(c.weightGrams, c.fineness, c.pureGramPrice), c.name).toBe(
        c.breakdown.metal,
      );
    }
  });

  it("equals the backend total when the rule is metal only", () => {
    const metalOnly = cases.linked.filter(
      (c) =>
        ["laborPerGram", "laborFixed", "stonePrice", "markupPercent"].every(
          (k) => Number(c.rule[k]) === 0,
        ) &&
        c.rule.minPrice === null &&
        c.rule.maxPrice === null,
    );
    expect(metalOnly.length).toBeGreaterThan(0);
    for (const c of metalOnly) {
      expect(metalValue(c.weightGrams, c.fineness, c.pureGramPrice), c.name).toBe(
        c.breakdown.total,
      );
    }
  });

  it("worked examples", () => {
    // 3 g x 0.585 x 200 = 351
    expect(metalValue("3", 585, "200")).toBe("351.00");
    // 4.2 g x 0.585 x 225.0552 = 552.960626...
    expect(metalValue("4.2", 585, "225.0552")).toBe("552.96");
    // 0.1 x 0.999 x 0.15 = 0.014985 -> 0.01
    expect(metalValue("0.1", 999, "0.15")).toBe("0.01");
    // exactly half a cent rounds up: 1 x 0.5 x 0.01 = 0.005
    expect(metalValue("1", 500, "0.01")).toBe("0.01");
    expect(metalValue("1", 500, "0.0098")).toBe("0.00");
    // the largest weight
    expect(metalValue("10000", 999, "3215.0747")).toBe("32118596.25");
  });

  it("agrees with the big.js implementation on a grid of inputs", () => {
    const weights = ["0.001", "0.5", "1", "2.345", "4.2", "17.999", "250", "9999.999"];
    const finenesses = [375, 583, 585, 750, 875, 916, 925, 999];
    const prices = ["0.0001", "2.7328", "88.1234", "225.0552", "238.5364"];
    const rule = {
      laborPerGram: "0",
      laborFixed: "0",
      stonePrice: "0",
      markupPercent: "0",
      minPrice: null,
      maxPrice: null,
    };
    for (const w of weights)
      for (const f of finenesses)
        for (const p of prices)
          expect(metalValue(w, f, p), `${w} ${f} ${p}`).toBe(
            metalLinkedPrice({ weightGrams: w, fineness: f, pureGramPrice: p, rule }),
          );
  });

  it("alloy gram price matches pricing.ts", () => {
    for (const f of [375, 585, 750, 916, 999, 925])
      expect(alloyGramPrice("225.0552", f)).toBe(bigAlloyGramPrice("225.0552", f));
  });

  it("rejects an impossible fineness", () => {
    expect(() => metalValue("1", 0, "1")).toThrow();
    expect(() => metalValue("1", 1001, "1")).toThrow();
  });
});

describe("parseWeight", () => {
  it.each([
    ["4.2", "4.2"],
    ["4,2", "4.2"],
    [" 4,250 ", "4.25"],
    ["004.500", "4.5"],
    [",5", "0.5"],
    ["5.", "5"],
    ["+3", "3"],
    ["0,001", "0.001"],
    ["10000", "10000"],
    ["10000.000", "10000"],
  ])("%s -> %s", (raw, value) => {
    expect(parseWeight(raw)).toEqual({ ok: true, value });
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    [undefined, "empty"],
    ["abc", "format"],
    ["1.000,5", "format"],
    ["1e3", "format"],
    [".", "format"],
    ["4..2", "format"],
    ["0", "notPositive"],
    ["0,000", "notPositive"],
    ["-1", "notPositive"],
    ["1.2345", "tooPrecise"],
    ["10000.001", "tooLarge"],
    ["99999999999999999999", "tooLarge"],
  ])("%s is %s", (raw, error) => {
    expect(parseWeight(raw)).toEqual({ ok: false, error });
  });
});

const prices = [
  {
    metal: "GOLD" as const,
    pricePerGram: "225.0552",
    pricePerOunce: "7000.00",
    date: "2026-11-03",
  },
  { metal: "SILVER" as const, pricePerGram: "2.7328", pricePerOunce: "85.00", date: "2026-11-03" },
  {
    metal: "PLATINUM" as const,
    pricePerGram: "93.2372",
    pricePerOunce: "2900.00",
    date: "2026-11-03",
  },
];

describe("buildOptions", () => {
  it("keeps metals that have a price and finenesses, in a fixed order", () => {
    const options = buildOptions(prices, FALLBACK_FINENESSES);
    expect(options.map((o) => o.metal)).toEqual(["GOLD", "SILVER"]);
    expect(options[0].finenesses.map((f) => f.value)).toEqual([375, 583, 585, 750, 916, 999]);
    expect(options[1].finenesses.map((f) => f.value)).toEqual([875, 925, 999]);
  });

  it("drops a metal without a price", () => {
    const fin: Fineness[] = [{ id: 1, metal: "PALLADIUM", value: 950, label: "950" }];
    expect(buildOptions(prices, fin)).toEqual([]);
    expect(buildOptions([], FALLBACK_FINENESSES)).toEqual([]);
  });
});

describe("URL parameters", () => {
  const options = buildOptions(prices, FALLBACK_FINENESSES);

  it("reads a shared link", () => {
    expect(
      selectionFromParams({ metal: "silver", fineness: "925", weight: "12,5" }, options),
    ).toEqual({
      metal: "SILVER",
      fineness: 925,
      weight: "12,5",
    });
  });

  it("falls back to gold 585 for unknown values", () => {
    expect(selectionFromParams({ metal: "iron", fineness: "123" }, options)).toEqual({
      metal: "GOLD",
      fineness: 585,
      weight: "",
    });
    expect(selectionFromParams({}, [])).toBeNull();
  });

  it("writes the weight with a dot", () => {
    expect(toQuery({ metal: "GOLD", fineness: 585, weight: "4,20" })).toBe(
      "?metal=gold&fineness=585&weight=4.2",
    );
    expect(toQuery({ metal: "SILVER", fineness: 925, weight: "" })).toBe(
      "?metal=silver&fineness=925",
    );
  });
});
