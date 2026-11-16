import { describe, expect, it } from "vitest";
import { evidenceCheck } from "@/lib/admin/evidence";
import { toProductInput, toProductRequest, type BackendProduct } from "./backend";
import { EMPTY_INPUT } from "./draft";
import { productSubmit } from "./schemas";

const product: BackendProduct = {
  id: 7,
  slug: "ring",
  status: "APPROVED",
  reviewNote: null,
  materialKind: "PRECIOUS",
  categoryId: 1,
  name: { az: "Üzük", en: null, ru: null },
  description: null,
  metal: "GOLD",
  images: [],
  variants: [],
  stones: [],
  evidencePhotos: [
    {
      id: 3,
      kind: "TAG",
      url: "https://cdn/t.jpg",
      status: "REJECTED",
      checkNote: "Oxunmur, yenidən",
    },
    { id: 2, kind: "HALLMARK", url: "https://cdn/h.jpg", status: "PENDING", checkNote: null },
  ],
};

describe("hallmark and label photos (#106)", () => {
  it("maps the stored photos with their check into the form", () => {
    const input = toProductInput(product, []);
    expect(input.materialKind).toBe("PRECIOUS");
    expect(input.evidence).toEqual({
      HALLMARK: { url: "https://cdn/h.jpg", status: "PENDING", checkNote: null },
      TAG: { url: "https://cdn/t.jpg", status: "REJECTED", checkNote: "Oxunmur, yenidən" },
    });
  });

  it("keeps the photos and the kind through the submit schema", () => {
    const parsed = productSubmit.parse({
      intent: "DRAFT",
      product: {
        ...EMPTY_INPUT,
        images: [{ id: "a", url: "data:image/jpeg;base64,AA==", name: "a" }],
        name: "Üzük",
        category: "rings",
        metal: "GOLD",
        fineness: "1",
        variants: [{ ...EMPTY_INPUT.variants[0], weightGrams: "2", price: "100" }],
        materialKind: "FASHION",
        evidence: { TAG: { url: "data:image/jpeg;base64,AA==" } },
      },
    });
    expect(parsed.product.materialKind).toBe("FASHION");
    expect(parsed.product.evidence?.TAG?.url).toContain("data:");
  });

  it("sends the form's material kind, else the stored one", () => {
    const base = { ...EMPTY_INPUT, fineness: "1" };
    expect(toProductRequest(base, [], product).materialKind).toBe("PRECIOUS");
    expect(toProductRequest({ ...base, materialKind: "FASHION" }, [], product).materialKind).toBe(
      "FASHION",
    );
  });

  it("asks a reason of 10+ characters only for a rejection", () => {
    expect(evidenceCheck.safeParse({ decision: "VERIFIED" }).success).toBe(true);
    expect(evidenceCheck.safeParse({ decision: "REJECTED", reason: "qısa" }).success).toBe(false);
    expect(
      evidenceCheck.safeParse({ decision: "REJECTED", reason: "Damğada 500 oxunur" }).success,
    ).toBe(true);
  });
});
