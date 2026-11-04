import { describe, expect, it } from "vitest";
import { formatDecimal, formatGrams, formatPrice } from "./money";

const intlPrice = (v: string, l: string) =>
  new Intl.NumberFormat(l, { style: "currency", currency: "AZN", minimumFractionDigits: 2 }).format(
    v as unknown as number,
  );
const intlGrams = (v: string, l: string) =>
  new Intl.NumberFormat(l, { style: "unit", unit: "gram", maximumFractionDigits: 3 }).format(
    v as unknown as number,
  );

describe("money formatting", () => {
  const prices = [
    "0.00",
    "5",
    "104.86",
    "508.75",
    "1440.00",
    "1248.5",
    "12345678.99",
    "999.995",
    "-5.00",
  ];
  const grams = ["1.2", "3.250", "0.005", "1234.25", "10", "2.0004", "9.9996"];

  for (const locale of ["az", "en", "ru"]) {
    it(`matches full ICU for ${locale}`, () => {
      for (const p of prices) expect(formatPrice(p, locale)).toBe(intlPrice(p, locale));
      for (const g of grams) expect(formatGrams(g, locale)).toBe(intlGrams(g, locale));
    });
  }

  it("keeps big values exact (no float rounding)", () => {
    expect(formatDecimal("12345678901234567.89", "en", { min: 2, max: 2 })).toBe(
      "12,345,678,901,234,567.89",
    );
  });
});
