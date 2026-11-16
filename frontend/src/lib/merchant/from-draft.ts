import type { ProductInput } from "@/types/merchant";
import { draftImageFormId } from "./backend";
import type { MerchantDraft } from "./bulk";
import { EMPTY_INPUT } from "./draft";

/**
 * The product form's start from a photo or catalog PDF draft (#109): the draft photo as the
 * first photo and the page's suggestions (name, price, weight) in their fields. Nothing is
 * published: the seller checks every field and the photo is attached only on save.
 */
export function draftInput(draft: MerchantDraft): ProductInput {
  const [first] = EMPTY_INPUT.variants;
  return {
    ...EMPTY_INPUT,
    images: [
      {
        id: draftImageFormId(draft.id),
        url: draft.imageUrl,
        name: `draft-${draft.id}`,
      },
    ],
    name: draft.suggestedName?.slice(0, 200) ?? "",
    variants: [
      {
        ...first,
        weightGrams: draft.suggestedWeight ?? "",
        price: draft.suggestedPrice ?? "",
      },
    ],
  };
}
