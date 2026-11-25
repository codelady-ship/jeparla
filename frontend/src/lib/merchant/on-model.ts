/**
 * "Show on a model" call to action of the product form (#316): what to say after a photo is
 * added and after the product is saved, and where AI Studio is.
 *
 * The backend queues an on-model image by itself only for the first photo of a product
 * (`jeparla.ai.auto-try-on` with a provider, #121), so "it started" is said only for a new
 * product. Otherwise the seller is sent to AI Studio, which needs a saved product.
 */
export type OnModelText =
  "autoNew" | "afterSave" | "studio" | "doneAuto" | "doneManual" | "notStarted";

export type OnModelPrompt = {
  text: OnModelText;
  /** The product's AI Studio, or null while the product is not saved. */
  href: string | null;
};

export const aiStudioHref = (productId: number) => `/merchant/products/${productId}/ai-studio`;

export function onModelPrompt({
  place,
  autoTryOn,
  creating,
  productId,
  started,
}: {
  /**
   * After a save with a picked model (#315): whether the API queued the on-model job. False when
   * it did not (daily quota or monthly budget used up, model no longer offered, audience changed):
   * the seller is told and sent to AI Studio instead of hearing nothing.
   */
  started?: boolean;
  /** "photos": step 1 with at least one photo; "done": the screen after saving. */
  place: "photos" | "done";
  autoTryOn: boolean;
  /** A new product (its first photo queues the automatic job), not an edit. */
  creating: boolean;
  productId: number | null;
}): OnModelPrompt {
  const href = productId === null ? null : aiStudioHref(productId);
  const auto = autoTryOn && creating;
  if (place === "done") {
    if (started !== undefined) return { text: started ? "doneAuto" : "notStarted", href };
    return { text: auto ? "doneAuto" : "doneManual", href };
  }
  if (auto) return { text: "autoNew", href: null };
  return href ? { text: "studio", href } : { text: "afterSave", href: null };
}
