import { describe, expect, it } from "vitest";
import type { ProductInput } from "@/types/merchant";
import type { Autofill } from "./autofill";
import { applyAutofill } from "./autofill-apply";
import { EMPTY_INPUT } from "./draft";

const categories = [
  { value: "nisan-uzukleri", audience: "WOMEN" as const },
  { value: "kisi-zergerliyi", audience: "MEN" as const },
];

const reading: Autofill = {
  name: "Leyla — qızıl nişan üzüyü",
  category: "nisan-uzukleri",
  metal: "GOLD",
  fineness: "2",
  weight: "3.2",
  price: "1250",
  description: "Ağ brilyantlı klassik nişan üzüyü.",
};

const form = (patch: Partial<ProductInput> = {}): ProductInput => ({ ...EMPTY_INPUT, ...patch });

describe("filling the product form from a reading", () => {
  it("fills every empty field and the audience of the category", () => {
    const r = applyAutofill(form(), reading, categories, false);
    expect(r.kept).toEqual([]);
    expect(r.filled).toEqual([
      "name",
      "category",
      "metal",
      "fineness",
      "weight",
      "price",
      "description",
    ]);
    expect(r.patch).toMatchObject({
      name: reading.name,
      category: "nisan-uzukleri",
      audience: "WOMEN",
      metal: "GOLD",
      fineness: "2",
      description: reading.description,
    });
    expect(r.patch.variants?.[0]).toMatchObject({ weightGrams: "3.2", price: "1250" });
  });

  it("never replaces what the seller typed or chose", () => {
    const typed = form({
      name: "Mənim öz adım",
      description: "Öz yazdığım uzun təsvir.",
      audience: "MEN",
      variants: [{ ...EMPTY_INPUT.variants[0], price: "999" }],
    });
    const r = applyAutofill(typed, reading, categories, false);
    expect(r.kept).toEqual(["name", "price", "description"]);
    expect(r.filled).toEqual(["category", "metal", "fineness", "weight"]);
    expect(r.patch.name).toBeUndefined();
    expect(r.patch.description).toBeUndefined();
    // The audience the seller picked by hand stays (the step 2 rule).
    expect(r.patch.audience).toBeUndefined();
    expect(r.patch.variants?.[0]).toMatchObject({ weightGrams: "3.2", price: "999" });
  });

  it("keeps a metal and fineness the seller chose", () => {
    const r = applyAutofill(form({ metal: "SILVER", fineness: "5" }), reading, categories, false);
    expect(r.kept).toContain("metal");
    expect(r.kept).toContain("fineness");
    expect(r.patch.metal).toBeUndefined();
    expect(r.patch.fineness).toBeUndefined();
  });

  it("fills only the fineness when the seller chose the same metal", () => {
    const r = applyAutofill(form({ metal: "GOLD" }), reading, categories, false);
    expect(r.patch.fineness).toBe("2");
    expect(r.kept).toEqual([]);
  });

  it("leaves metal and fineness out for bijouterie", () => {
    const r = applyAutofill(form(), reading, categories, true);
    expect(r.filled).not.toContain("metal");
    expect(r.filled).not.toContain("fineness");
    expect(r.patch.metal).toBeUndefined();
  });

  it("changes nothing when every field is already filled", () => {
    const full = form({
      name: "A",
      category: "kisi-zergerliyi",
      description: "B",
      metal: "GOLD",
      fineness: "3",
      variants: [{ ...EMPTY_INPUT.variants[0], weightGrams: "1", price: "2" }],
    });
    const r = applyAutofill(full, reading, categories, false);
    expect(r.filled).toEqual([]);
    expect(r.kept).toEqual(["name", "category", "fineness", "weight", "price", "description"]);
    expect(r.patch).toEqual({});
  });
});
