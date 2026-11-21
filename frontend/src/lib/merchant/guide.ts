/**
 * The first-visit guide of the seller cabinet (#176): three short steps, shown until the
 * seller closes it, then never again in this browser. Remembered the way the install card
 * remembers its dismissal (lib/pwa/install.ts): one localStorage key, every access guarded,
 * because storage can be missing or throw (private mode, blocked site data).
 */
import type { KeyValueStore } from "@/lib/pwa/install";

export const GUIDE_DISMISSED_KEY = "jeparla-seller-guide-dismissed";

export function isGuideDismissed(local: KeyValueStore | null): boolean {
  try {
    return local?.getItem(GUIDE_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Returns false when the browser did not keep it (the guide then stays closed for this page only). */
export function dismissGuide(local: KeyValueStore | null): boolean {
  try {
    if (!local) return false;
    local.setItem(GUIDE_DISMISSED_KEY, "1");
    return true;
  } catch {
    return false;
  }
}
