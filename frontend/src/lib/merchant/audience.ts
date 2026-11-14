import type { ProductAudience } from "@/types/merchant";

type CategoryNode = { id: number; slug: string; parentId: number | null };

/** Root categories whose products are for men or children; mirrors backend AudienceRules. */
const ROOT_AUDIENCE: Record<string, ProductAudience> = {
  "kisi-zergerliyi": "MEN",
  "usaq-zergerliyi": "KIDS",
};

/**
 * Suggested audience of a product in a category (#121): MEN or KIDS below those
 * root categories, UNISEX otherwise. The seller can always change it.
 */
export function suggestAudience(
  categoryId: number | null | undefined,
  categories: readonly CategoryNode[],
): ProductAudience {
  const byId = new Map(categories.map((c) => [c.id, c]));
  let node = categoryId == null ? undefined : byId.get(categoryId);
  // A bounded walk: a broken tree (a cycle) cannot hang the page.
  for (let i = 0; node && node.parentId !== null && i < 20; i++) {
    node = byId.get(node.parentId);
  }
  return (node && ROOT_AUDIENCE[node.slug]) ?? "UNISEX";
}
