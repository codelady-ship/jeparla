import { USING_MOCK } from "@/lib/api";
import { userFetch } from "@/lib/auth/backend";
import type { MetalType } from "@/types/api";

/** GET/PUT /api/v1/merchant/products/{id}/metal-sibling (V70): the same design in another metal. */
export type MetalSiblings = {
  siblingId: number | null;
  options: { id: number; name: string; metal: MetalType; linkedElsewhere: boolean }[];
};

/** The link and its choices for the edit page; null with the sample data or when the API fails. */
export async function metalSiblings(productId: number): Promise<MetalSiblings | null> {
  if (USING_MOCK) return null;
  return userFetch<MetalSiblings>(`/merchant/products/${productId}/metal-sibling`, {
    canRefresh: true,
  }).catch(() => null);
}
