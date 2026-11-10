import { describe, expect, it, vi } from "vitest";
import { prefersNativeShare, shareOrCopy } from "./share";

const link = { url: "https://jeparla.az/az/products/ring", title: "Ring" };

function env({
  coarse,
  share,
  canShare = true,
  clipboard = true,
}: {
  coarse: boolean;
  share?: (d: unknown) => Promise<void>;
  canShare?: boolean;
  clipboard?: boolean | "fails";
}) {
  const writeText = vi.fn(async () => {
    if (clipboard === "fails") throw new DOMException("denied", "NotAllowedError");
  });
  return {
    writeText,
    env: {
      navigator: {
        share,
        canShare: () => canShare,
        clipboard: clipboard ? { writeText } : undefined,
      },
      matchMedia: (q: string) => ({ matches: coarse && q === "(pointer: coarse)" }),
    },
  };
}

describe("shareOrCopy", () => {
  it("opens the system share sheet on touch devices", async () => {
    const share = vi.fn(async () => {});
    const { env: e, writeText } = env({ coarse: true, share });
    expect(prefersNativeShare(e)).toBe(true);
    expect(await shareOrCopy(link, e)).toBe("shared");
    expect(share).toHaveBeenCalledWith(link);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("says nothing when the visitor closes the share sheet", async () => {
    const share = vi.fn(async () => {
      throw new DOMException("closed", "AbortError");
    });
    const { env: e, writeText } = env({ coarse: true, share });
    expect(await shareOrCopy(link, e)).toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies the link on desktop even when navigator.share exists", async () => {
    const share = vi.fn(async () => {});
    const { env: e, writeText } = env({ coarse: false, share });
    expect(await shareOrCopy(link, e)).toBe("copied");
    expect(share).not.toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith(link.url);
  });

  it("copies when the share sheet fails or cannot take the data", async () => {
    const failing = vi.fn(async () => {
      throw new DOMException("no", "NotAllowedError");
    });
    expect(await shareOrCopy(link, env({ coarse: true, share: failing }).env)).toBe("copied");
    const ok = vi.fn(async () => {});
    expect(await shareOrCopy(link, env({ coarse: true, share: ok, canShare: false }).env)).toBe(
      "copied",
    );
    expect(ok).not.toHaveBeenCalled();
  });

  it("reports a failure when nothing works", async () => {
    expect(await shareOrCopy(link, env({ coarse: false, clipboard: false }).env)).toBe("failed");
    expect(await shareOrCopy(link, env({ coarse: false, clipboard: "fails" }).env)).toBe("failed");
  });
});
