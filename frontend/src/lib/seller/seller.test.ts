import { beforeEach, describe, expect, it } from "vitest";
import { fieldErrors } from "@/lib/auth/schemas";
import { firstOpenStep, sellerDraft } from "./draft";
import { normalizePhone, productStep, storeStep } from "./schemas";

beforeEach(() => {
  localStorage.clear();
  sellerDraft.clear();
});

describe("normalizePhone", () => {
  it("accepts common Azerbaijani mobile formats", () => {
    expect(normalizePhone("050 123 45 67")).toBe("+994501234567");
    expect(normalizePhone("+994 (55) 123-45-67")).toBe("+994551234567");
    expect(normalizePhone("701234567")).toBe("+994701234567");
  });
  it("rejects landlines, short numbers and unknown codes", () => {
    expect(normalizePhone("012 345 67 89")).toBeNull();
    expect(normalizePhone("050 123")).toBeNull();
    expect(normalizePhone("+994 33 123 45 67")).toBeNull();
  });
});

describe("store step", () => {
  const ok = {
    storeName: "Ayzer",
    whatsapp: "0501234567",
    city: "Baki",
    address: "Nizami kuc. 10",
    social: "@ayzer.az",
    legalType: "SOLE_TRADER",
    taxId: "1234567890",
  };
  it("passes a complete store", () => {
    expect(storeStep.safeParse(ok).success).toBe(true);
  });
  it("checks VOEN and social link", () => {
    const r = storeStep.safeParse({ ...ok, taxId: "12345", social: "instagram" });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(fieldErrors(r.error)).toEqual({ taxId: "taxIdInvalid", social: "socialInvalid" });
  });
});

describe("product step", () => {
  it("keeps weight and price as exact strings, accepting a decimal comma", () => {
    const r = productStep.safeParse({
      productName: "Uzuk",
      category: "uzukler",
      fineness: "585",
      weight: "3,25",
      price: "1248.50",
    });
    expect(r.success && r.data.weight).toBe("3.25");
    expect(r.success && r.data.price).toBe("1248.50");
  });
  it("rejects zero, negative and over-precise values", () => {
    for (const weight of ["0", "-1", "1.2345", "abc"]) {
      const r = productStep.safeParse({
        productName: "Uzuk",
        category: "uzukler",
        fineness: "585",
        weight,
        price: "10",
      });
      expect(r.success).toBe(false);
    }
  });
});

describe("draft", () => {
  it("persists across reads and never holds a password", () => {
    sellerDraft.update((d) => ({
      ...d,
      account: { name: "Aysel", phone: "0501234567" },
      done: [1],
    }));
    expect(JSON.parse(localStorage.getItem("jeparla-seller-draft") ?? "{}")).toMatchObject({
      account: { name: "Aysel" },
      done: [1],
    });
    expect(localStorage.getItem("jeparla-seller-draft")).not.toMatch(/password/i);
  });
  it("finds the first open step", () => {
    expect(firstOpenStep([])).toBe(1);
    expect(firstOpenStep([1, 2])).toBe(3);
    expect(firstOpenStep([1, 3])).toBe(2);
  });
});
