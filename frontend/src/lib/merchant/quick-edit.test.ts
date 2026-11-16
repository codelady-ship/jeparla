import { describe, expect, it } from "vitest";
import { EMPTY_INPUT } from "./draft";
import { applyQuick, quickErrors, quickFromInput, sameQuick } from "./quick-edit";
import type { ProductInput } from "@/types/merchant";

const stored: ProductInput = {
  ...EMPTY_INPUT,
  name: "Üzük",
  category: "rings",
  metal: "GOLD",
  fineness: "3",
  pricingMode: "FIXED",
  variants: [{ key: "v7", size: "17", weightGrams: "3.2", price: "450", stockStatus: "IN_STOCK" }],
};

describe("quick edit of drafts", () => {
  it("reads the quick fields of a stored product", () => {
    expect(quickFromInput(7, stored)).toEqual({
      id: 7,
      fashion: false,
      variantCount: 1,
      category: "rings",
      metal: "GOLD",
      fineness: "3",
      weightGrams: "3.2",
      pricingMode: "FIXED",
    });
  });

  it("leaves weight out for several variants and metal out for bijouterie", () => {
    const two = { ...stored, variants: [...stored.variants, { ...stored.variants[0], key: "v8" }] };
    expect(quickFromInput(1, two).weightGrams).toBe("");
    const fashion = quickFromInput(2, { ...stored, materialKind: "FASHION" });
    expect(fashion).toMatchObject({ fashion: true, metal: "", fineness: "", pricingMode: "FIXED" });
  });

  it("changes only the quick fields and keeps the rest", () => {
    const next = applyQuick(stored, {
      category: "earrings",
      metal: "SILVER",
      fineness: "9",
      weightGrams: " 4,5 ",
      pricingMode: "METAL_LINKED",
    });
    expect(next).toMatchObject({
      name: "Üzük",
      category: "earrings",
      metal: "SILVER",
      fineness: "9",
      pricingMode: "METAL_LINKED",
    });
    expect(next.variants).toEqual([{ ...stored.variants[0], weightGrams: "4.5" }]);
  });

  it("does not give bijouterie a metal or several variants one weight", () => {
    const fashion = { ...stored, materialKind: "FASHION" as const, metal: "" as const };
    const next = applyQuick(fashion, {
      category: "rings",
      metal: "GOLD",
      fineness: "3",
      weightGrams: "1",
      pricingMode: "METAL_LINKED",
    });
    expect(next.metal).toBe("");
    expect(next.pricingMode).toBe("FIXED");
    const two = { ...stored, variants: [...stored.variants, { ...stored.variants[0], key: "v8" }] };
    expect(applyQuick(two, { ...quickFromInput(1, two), weightGrams: "9" }).variants).toBe(
      two.variants,
    );
  });

  it("checks a row before it is sent", () => {
    const ok = quickFromInput(7, stored);
    expect(quickErrors(ok, false)).toBeNull();
    expect(quickErrors({ ...ok, category: "" }, false)).toEqual({ category: "required" });
    expect(quickErrors({ ...ok, weightGrams: "abc" }, false)).toEqual({
      weightGrams: "decimalInvalid",
    });
    expect(quickErrors({ ...ok, fineness: "" }, false)).toEqual({ fineness: "required" });
    expect(
      quickErrors({ ...ok, metal: "", fineness: "", pricingMode: "METAL_LINKED" }, false),
    ).toEqual({ metal: "required" });
    expect(quickErrors({ ...ok, weightGrams: "", pricingMode: "METAL_LINKED" }, false)).toEqual({
      weightGrams: "required",
    });
    // Bijouterie has no metal to choose.
    expect(quickErrors({ ...ok, metal: "", fineness: "" }, true)).toBeNull();
  });

  it("compares rows ignoring spaces around the weight", () => {
    const a = quickFromInput(7, stored);
    expect(sameQuick(a, { ...a, weightGrams: " 3.2 " })).toBe(true);
    expect(sameQuick(a, { ...a, pricingMode: "METAL_LINKED" })).toBe(false);
  });
});
