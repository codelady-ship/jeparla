import { describe, expect, it } from "vitest";
import { PRODUCTS, VIDEO_PRODUCT_ID } from "@/lib/api/mock/fixtures";
import { toMerchantProduct, type BackendProduct } from "./backend";
import { clipLength, VIDEO_MAX_BYTES, videoProblem, type MerchantVideo } from "./video";

const stored: MerchantVideo = {
  url: "https://img.example/products/1/7/video/clip.mp4",
  contentType: "video/mp4",
  sizeBytes: 1_200_000,
  durationMs: 9400,
  width: 1080,
  height: 1920,
  aiGenerated: true,
};

const product: BackendProduct = {
  id: 7,
  slug: "ring",
  status: "DRAFT",
  reviewNote: null,
  materialKind: "PRECIOUS",
  categoryId: 1,
  name: { az: "Üzük", en: null, ru: null },
  description: null,
  metal: "GOLD",
  images: [],
  variants: [],
  stones: [],
};

describe("product video (#117)", () => {
  it("accepts MP4 and WebM of up to 8 MB and 15 seconds", () => {
    expect(videoProblem({ type: "video/mp4", size: 3_000_000 }, 9.4)).toBeNull();
    expect(videoProblem({ type: "video/webm", size: VIDEO_MAX_BYTES }, 15)).toBeNull();
    // A phone that stops at 15 seconds writes a few frames more.
    expect(videoProblem({ type: "video/mp4", size: 1000 }, 15.4)).toBeNull();
  });

  it("names what is wrong with another file before it is sent", () => {
    expect(videoProblem({ type: "video/quicktime", size: 1000 }, 5)).toBe("badType");
    expect(videoProblem({ type: "image/gif", size: 1000 }, null)).toBe("badType");
    expect(videoProblem({ type: "video/mp4", size: VIDEO_MAX_BYTES + 1 }, 5)).toBe("tooBig");
    expect(videoProblem({ type: "video/mp4", size: 1000 }, 15.6)).toBe("tooLong");
  });

  it("leaves a file whose length the browser cannot read to the API", () => {
    expect(videoProblem({ type: "video/mp4", size: 1000 }, null)).toBeNull();
  });

  it("writes the length of a clip as minutes and seconds", () => {
    expect(clipLength(9400)).toBe("0:09");
    expect(clipLength(15_000)).toBe("0:15");
    expect(clipLength(300)).toBe("0:01");
  });

  it("carries the stored video into the cabinet and null when there is none", () => {
    expect(toMerchantProduct({ ...product, video: stored }, []).video).toEqual(stored);
    expect(toMerchantProduct(product, []).video).toBeNull();
  });

  it("gives exactly one sample product a video, a clip within the limits", () => {
    const withVideo = PRODUCTS.filter((p) => p.video);
    expect(withVideo.map((p) => p.id)).toEqual([VIDEO_PRODUCT_ID]);
    const video = withVideo[0].video!;
    expect(video.url).toBe("/demo/ring-video.mp4");
    expect(video.durationMs).toBeLessThanOrEqual(15_000);
    expect(video.aiGenerated).toBe(false);
  });
});
