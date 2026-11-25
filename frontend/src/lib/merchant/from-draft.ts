import type { ProductInput } from "@/types/merchant";
import {
  filledFields,
  readProductText,
  type Autofill,
  type AutofillCategory,
  type AutofillField,
  type AutofillFineness,
} from "./autofill";
import { draftImageFormId } from "./backend";
import type { MerchantDraft } from "./bulk";
import { EMPTY_INPUT } from "./draft";

/** What the form offers: a suggestion outside these is dropped. */
export type DraftOptions = { categories: AutofillCategory[]; finenesses: AutofillFineness[] };

/**
 * What a draft suggests: the backend's name, price and weight, completed from the PDF page text
 * (category, metal, fineness, description; and name, price, weight when the backend had none).
 */
export function draftSuggestions(draft: MerchantDraft, options?: DraftOptions): Autofill {
  const read: Autofill | null =
    draft.pageText && options ? readProductText(draft.pageText, options) : null;
  return {
    name: draft.suggestedName ?? read?.name ?? null,
    category: read?.category ?? null,
    metal: read?.metal ?? null,
    fineness: read?.fineness ?? null,
    weight: draft.suggestedWeight ?? read?.weight ?? null,
    price: draft.suggestedPrice ?? read?.price ?? null,
    description: read?.description ?? null,
  };
}

/** The fields a draft fills, in form order (for the note above the form). */
export const draftFilledFields = (draft: MerchantDraft, options?: DraftOptions): AutofillField[] =>
  filledFields(draftSuggestions(draft, options));

/**
 * The product form's start from a photo or catalog PDF draft (#109): the draft photo as the
 * first photo and the page's suggestions in their fields. Nothing is published: the seller
 * checks every field and the photo is attached only on save.
 */
export function draftInput(draft: MerchantDraft, options?: DraftOptions): ProductInput {
  const [first] = EMPTY_INPUT.variants;
  const s = draftSuggestions(draft, options);
  return {
    ...EMPTY_INPUT,
    images: [
      {
        id: draftImageFormId(draft.id),
        url: draft.imageUrl,
        name: `draft-${draft.id}`,
      },
    ],
    name: s.name?.slice(0, 120) ?? "",
    category: s.category ?? "",
    description: s.description ?? "",
    metal: s.metal ?? "",
    fineness: s.fineness ?? "",
    variants: [
      {
        ...first,
        weightGrams: s.weight ?? "",
        price: s.price ?? "",
      },
    ],
  };
}
