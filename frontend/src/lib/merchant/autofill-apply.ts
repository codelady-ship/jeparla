import type { ProductAudience, ProductInput } from "@/types/merchant";
import type { Autofill, AutofillField } from "./autofill";

/**
 * What "fill from text" changes: a form patch, the fields filled, the fields kept as typed, and
 * the fields that already hold the value read (a second press: neither filled nor kept).
 */
export type AutofillApplied = {
  patch: Partial<ProductInput>;
  filled: AutofillField[];
  kept: AutofillField[];
  same: AutofillField[];
};

/**
 * "Fill from text" (#329) on the product form: only empty fields are filled; what the seller
 * already typed or chose is kept and reported back, so nothing she wrote is lost. Metal and
 * fineness are left out for bijouterie (FASHION).
 */
export function applyAutofill(
  p: ProductInput,
  a: Autofill,
  categories: { value: string; audience?: ProductAudience }[],
  fashion: boolean,
): AutofillApplied {
  const patch: Partial<ProductInput> = {};
  const filled: AutofillField[] = [];
  const kept: AutofillField[] = [];
  const same: AutofillField[] = [];
  /** Fills an empty field; a field already holding the value read is "same", any other is kept. */
  const put = (
    field: AutofillField,
    current: string,
    value: string,
    empty: boolean,
    apply: () => void,
  ) => {
    if (current.trim() === value.trim()) same.push(field);
    else if (empty) {
      apply();
      filled.push(field);
    } else kept.push(field);
  };
  if (a.name) put("name", p.name, a.name, !p.name.trim(), () => (patch.name = a.name!));
  if (a.category) {
    const category = a.category;
    put("category", p.category, category, !p.category, () => {
      patch.category = category;
      // The audience follows the category only until the seller picks one (as in step 2).
      const suggested = (slug: string) =>
        categories.find((c) => c.value === slug)?.audience ?? "UNISEX";
      if (p.audience === suggested(p.category)) patch.audience = suggested(category);
    });
  }
  if (!fashion && a.metal) {
    const metal = a.metal;
    put("metal", p.metal, metal, !p.metal, () => (patch.metal = metal));
  }
  if (!fashion && a.fineness) {
    const fineness = a.fineness;
    // A fineness only next to its own metal; one the seller already chose stays.
    const metal = patch.metal ?? p.metal;
    put(
      "fineness",
      p.fineness,
      fineness,
      !p.fineness && metal === a.metal,
      () => (patch.fineness = fineness),
    );
  }
  const [first] = p.variants;
  let variant = first;
  if (a.weight)
    put(
      "weight",
      first.weightGrams,
      a.weight,
      !first.weightGrams.trim(),
      () => (variant = { ...variant, weightGrams: a.weight! }),
    );
  if (a.price)
    put(
      "price",
      first.price,
      a.price,
      !first.price.trim(),
      () => (variant = { ...variant, price: a.price! }),
    );
  if (variant !== first) patch.variants = [variant, ...p.variants.slice(1)];
  if (a.description)
    put(
      "description",
      p.description,
      a.description,
      !p.description.trim(),
      () => (patch.description = a.description!),
    );
  return { patch, filled, kept, same };
}
