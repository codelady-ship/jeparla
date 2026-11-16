import { describe, expect, it } from "vitest";
import { storeStep } from "@/lib/seller/schemas";
import { toProductRequest } from "./backend";
import { EMPTY_INPUT, EMPTY_PRICING } from "./draft";
import { metalStep, pathErrors, profileSchema } from "./schemas";

const variant = {
  key: "a",
  size: "",
  weightGrams: "",
  price: "25",
  stockStatus: "IN_STOCK" as const,
};

describe("bijouterie (FASHION) products (#128)", () => {
  it("needs a material and the confirmation, not a metal, fineness or weight", () => {
    const base = {
      materialKind: "FASHION",
      metal: "",
      fineness: "",
      pricingMode: "FIXED",
      pricing: EMPTY_PRICING,
      variants: [variant],
    };
    const missing = metalStep.safeParse(base);
    expect(missing.success).toBe(false);
    if (!missing.success)
      expect(pathErrors(missing.error)).toEqual({
        material: "required",
        notPreciousConfirmed: "notPreciousRequired",
      });
    expect(
      metalStep.safeParse({ ...base, material: "BEADS", notPreciousConfirmed: true }).success,
    ).toBe(true);
  });

  it("refuses a metal-linked price", () => {
    const r = metalStep.safeParse({
      materialKind: "FASHION",
      metal: "",
      fineness: "",
      material: "BRASS",
      notPreciousConfirmed: true,
      pricingMode: "METAL_LINKED",
      pricing: EMPTY_PRICING,
      variants: [variant],
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(pathErrors(r.error).pricingMode).toBe("fashionFixedOnly");
  });

  it("still needs metal, fineness and weight for precious products", () => {
    const r = metalStep.safeParse({
      metal: "",
      fineness: "",
      pricingMode: "FIXED",
      pricing: EMPTY_PRICING,
      variants: [variant],
    });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(pathErrors(r.error)).toEqual({
        metal: "required",
        fineness: "required",
        "variants.0.weightGrams": "required",
      });
  });

  it("sends material, no fineness and a FIXED price", () => {
    const body = toProductRequest(
      {
        ...EMPTY_INPUT,
        materialKind: "FASHION",
        material: "BEADS",
        notPreciousConfirmed: true,
        pricingMode: "METAL_LINKED",
        variants: [{ ...variant, price: "25,50" }],
      },
      [],
      null,
    );
    expect(body).toMatchObject({
      materialKind: "FASHION",
      metal: null,
      material: "BEADS",
      notPreciousConfirmed: true,
    });
    expect(body.variants[0]).toMatchObject({
      finenessId: null,
      weightGrams: null,
      pricingMode: "FIXED",
      price: "25.50",
      rule: null,
    });
  });

  it("asks the seller kind in the wizard and keeps it in the profile", () => {
    const store = {
      storeName: "Muncuq",
      whatsapp: "050 123 45 67",
      city: "Bakı",
      address: "Nizami küçəsi 5",
      social: "",
      legalType: "SOLE_TRADER",
      taxId: "1234567890",
      codeAccepted: true,
    };
    expect(storeStep.parse(store).sellerKind).toBe("PRECIOUS");
    expect(storeStep.parse({ ...store, sellerKind: "FASHION" }).sellerKind).toBe("FASHION");
    expect(storeStep.safeParse({ ...store, sellerKind: "GOLD" }).success).toBe(false);
    expect(
      profileSchema.safeParse({
        name: "Muncuq",
        whatsapp: "050 123 45 67",
        city: "Bakı",
        address: "Nizami küçəsi 5",
        social: "",
        description: "",
        openingHours: "",
        sellerKind: "MIXED",
      }).success,
    ).toBe(true);
  });
});
