import { describe, expect, it } from "vitest";
import { PRODUCTS } from "@/lib/api/mock/fixtures";
import { product } from "@/lib/seo/json-ld";
import { formatMm } from "@/lib/money";
import { toProductRequest } from "./backend";
import { EMPTY_INPUT } from "./draft";
import { basicsStep, pathErrors, profileSchema } from "./schemas";

const basics = { name: "Qızıl üzük", category: "1", audience: "UNISEX", description: "" };

describe("product dimensions and key features (#174)", () => {
  it("accepts empty sizes and refuses zero or too many decimals", () => {
    expect(basicsStep.safeParse({ ...basics, dimensions: { widthMm: "" } }).success).toBe(true);
    const r = basicsStep.safeParse({
      ...basics,
      dimensions: { widthMm: "2,5", thicknessMm: "0", diameterMm: "1.234" },
    });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(pathErrors(r.error)).toEqual({
        "dimensions.thicknessMm": "decimalInvalid",
        "dimensions.diameterMm": "decimalInvalid",
      });
  });

  it("allows at most five non-blank key features", () => {
    const six = ["a", "b", "c", "d", "e", "f"];
    expect(basicsStep.safeParse({ ...basics, keyFeatures: [...six.slice(0, 5), ""] }).success).toBe(
      true,
    );
    const r = basicsStep.safeParse({ ...basics, keyFeatures: six });
    expect(r.success).toBe(false);
    if (!r.success) expect(pathErrors(r.error)).toEqual({ keyFeatures: "keyFeaturesTooMany" });
  });

  it("sends sizes as decimals and drops blank features", () => {
    const body = toProductRequest(
      {
        ...EMPTY_INPUT,
        dimensions: { widthMm: " 2,5 ", lengthMm: "" },
        keyFeatures: [" Əl işi ", "", "Hər gün üçün"],
      },
      [],
      null,
    );
    expect(body).toMatchObject({
      dimensions: { widthMm: "2.5", thicknessMm: null, lengthMm: null, diameterMm: null },
      keyFeatures: ["Əl işi", "Hər gün üçün"],
    });
    expect(toProductRequest(EMPTY_INPUT, [], null)).toMatchObject({
      dimensions: null,
      keyFeatures: [],
    });
  });

  it("puts only the entered sizes into JSON-LD in millimetres", () => {
    const p = {
      ...PRODUCTS[0],
      dimensions: { widthMm: "2.50", thicknessMm: null, lengthMm: null, diameterMm: null },
    };
    const ld = product(p, "en") as { additionalProperty: Record<string, unknown>[] };
    const sizes = ld.additionalProperty.filter((x) => x.unitCode === "MMT");
    expect(sizes).toEqual([
      { "@type": "PropertyValue", name: "width", value: "2.50", unitCode: "MMT" },
    ]);
    expect(formatMm("2.50", "az")).toBe("2,5 mm");
  });
});

describe("store services (#174)", () => {
  it("knows the five services and limits the return terms", () => {
    const base = {
      name: "Test",
      whatsapp: "+994501234567",
      city: "Bakı",
      address: "Nizami küç. 1",
      social: "",
      description: "",
      openingHours: "",
    };
    expect(profileSchema.safeParse({ ...base, services: ["ENGRAVING"] }).success).toBe(true);
    expect(profileSchema.safeParse({ ...base, services: ["GUARANTEE"] }).success).toBe(false);
    const long = profileSchema.safeParse({ ...base, returnPolicy: "x".repeat(501) });
    expect(long.success).toBe(false);
    if (!long.success) expect(pathErrors(long.error)).toEqual({ returnPolicy: "returnPolicyLong" });
  });
});
