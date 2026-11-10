/**
 * Share a link: the system share sheet on phones and tablets (Web Share API), a copy
 * to the clipboard elsewhere. Desktop browsers that have navigator.share (Chrome on
 * Windows, Safari on macOS) still copy, because a copied link is what people expect
 * from a desktop "share" and the system dialogs there are clumsy. No analytics.
 */
export type ShareLink = { url: string; title?: string; text?: string };
export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

type ShareEnv = {
  navigator: {
    share?: (data: ShareLink) => Promise<void>;
    canShare?: (data: ShareLink) => boolean;
    clipboard?: Pick<Clipboard, "writeText">;
  };
  matchMedia: (query: string) => { matches: boolean };
};

/** A touch-first device (phone, tablet) with the Web Share API. */
export function prefersNativeShare(env: ShareEnv): boolean {
  const nav = env.navigator;
  if (typeof nav.share !== "function") return false;
  // Same test as the button label (CSS pointer-coarse), so the label never lies.
  return env.matchMedia("(pointer: coarse)").matches;
}

export async function shareOrCopy(data: ShareLink, env: ShareEnv): Promise<ShareOutcome> {
  const nav = env.navigator;
  if (prefersNativeShare(env) && (!nav.canShare || nav.canShare(data))) {
    try {
      await nav.share!(data);
      return "shared";
    } catch (err) {
      // The visitor closed the sheet: nothing to report.
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      // Any other failure (e.g. permission): fall through to copying.
    }
  }
  try {
    if (!nav.clipboard) return "failed";
    await nav.clipboard.writeText(data.url);
    return "copied";
  } catch {
    return "failed";
  }
}
