import { describe, expect, it } from "vitest";
import { approxPrices, convertFromAzn, formatApprox } from "./currency";

describe("USD/EUR display (#53)", () => {
  it("divides exactly and rounds half-up to cents", () => {
    expect(convertFromAzn("1700.00", "1.7")).toBe("1000.00");
    expect(convertFromAzn("508.75", "1.9037")).toBe("267.24");
    expect(convertFromAzn("0.01", "3")).toBe("0.00");
    expect(convertFromAzn("0.015", "1")).toBe("0.02");
    expect(convertFromAzn("12345678.99", "1.700000")).toBe("7262164.11");
  });

  it("refuses a zero or negative rate", () => {
    expect(() => convertFromAzn("10", "0")).toThrow(RangeError);
    expect(() => convertFromAzn("10", "-1.7")).toThrow(RangeError);
  });

  it("formats per locale, always marked approximate", () => {
    expect(formatApprox("1234.5", "USD", "en")).toBe("≈ $1,234.50");
    expect(formatApprox("1234.5", "EUR", "az")).toBe("≈ 1.234,50 €");
    expect(formatApprox("1234.5", "USD", "ru")).toBe("≈ 1\u00a0234,50 $");
  });

  it("converts to each currency with a rate", () => {
    const rates = [
      { currency: "USD" as const, date: "2026-11-06", aznPerUnit: "1.700000", fetchedAt: "" },
    ];
    expect(approxPrices("170.00", rates, "en")).toEqual({ USD: "≈ $100.00" });
    expect(approxPrices("170.00", [], "en")).toEqual({});
  });
});
