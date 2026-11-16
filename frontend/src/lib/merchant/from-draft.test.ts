import { describe, expect, it } from "vitest";
import { backendImageId, draftImageId } from "./backend";
import type { MerchantDraft } from "./bulk";
import { productDraft } from "./draft";
import { draftInput } from "./from-draft";

const draft: MerchantDraft = {
  id: 42,
  source: "PDF",
  imageUrl: "https://private.example/drafts/1/a.jpg?sig=x",
  imageUrlExpiresAt: "2026-11-16T10:15:00Z",
  width: 900,
  height: 1200,
  pdfPage: 3,
  suggestedName: "Qızıl üzük",
  suggestedPrice: "1250.50",
  suggestedWeight: "4.200",
  createdAt: "2026-11-16T10:00:00Z",
};

describe("product form from a draft", () => {
  it("starts with the draft photo and the page's suggestions", () => {
    const input = draftInput(draft);
    expect(input.images).toEqual([{ id: "draft42", url: draft.imageUrl, name: "draft-42" }]);
    expect(input.name).toBe("Qızıl üzük");
    expect(input.variants[0]).toMatchObject({ weightGrams: "4.200", price: "1250.50" });
  });

  it("leaves fields empty without suggestions", () => {
    const input = draftInput({
      ...draft,
      suggestedName: null,
      suggestedPrice: null,
      suggestedWeight: null,
    });
    expect(input.name).toBe("");
    expect(input.variants[0]).toMatchObject({ weightGrams: "", price: "" });
  });

  it("starts the form of a draft at the first step, like a new product", () => {
    expect(productDraft("draft-42", draftInput(draft)).get().done).toEqual([]);
  });

  it("keeps draft photos apart from stored product photos", () => {
    expect(draftImageId("draft42")).toBe(42);
    expect(backendImageId("draft42")).toBeNull();
    expect(draftImageId("img7")).toBeNull();
  });
});
