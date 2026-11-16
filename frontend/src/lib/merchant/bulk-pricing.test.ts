import { describe, expect, it } from "vitest";
import { bulkPricingBody } from "./bulk-pricing";

describe("bulk pricing body", () => {
  it("freezes the current price for FIXED and ignores the labour field", () => {
    expect(bulkPricingBody([1, 2], "FIXED", "")).toEqual({
      ok: true,
      body: { ids: [1, 2], pricingMode: "FIXED" },
    });
  });

  it("needs labour per gram for METAL_LINKED and reads a comma as a dot", () => {
    expect(bulkPricingBody([1], "METAL_LINKED", "")).toEqual({ ok: false, error: "laborRequired" });
    expect(bulkPricingBody([1], "METAL_LINKED", "12,5")).toEqual({
      ok: true,
      body: { ids: [1], pricingMode: "METAL_LINKED", laborPerGram: "12.5" },
    });
  });

  it("sets labour alone, and refuses an empty or bad form", () => {
    expect(bulkPricingBody([3], "", "15")).toEqual({
      ok: true,
      body: { ids: [3], laborPerGram: "15" },
    });
    expect(bulkPricingBody([3], "", "")).toEqual({ ok: false, error: "pricingEmpty" });
    expect(bulkPricingBody([3], "", "1.234")).toEqual({ ok: false, error: "laborInvalid" });
    expect(bulkPricingBody([3], "", "-2")).toEqual({ ok: false, error: "laborInvalid" });
  });
});
