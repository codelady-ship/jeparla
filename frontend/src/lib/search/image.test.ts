import { describe, expect, it } from "vitest";
import {
  clampCrop,
  cropPixels,
  filterEntries,
  fitSize,
  FULL_CROP,
  isImageMagic,
  MIN_CROP,
  moveCrop,
  resizeCrop,
} from "./image";

describe("search by photo (#163)", () => {
  it("recognises JPEG, PNG and WebP by their first bytes only", () => {
    expect(isImageMagic(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(isImageMagic(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBe(true);
    expect(
      isImageMagic(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])),
    ).toBe(true);
    expect(isImageMagic(new TextEncoder().encode("GIF89a"))).toBe(false);
    expect(isImageMagic(new Uint8Array([]))).toBe(false);
  });

  it("keeps the frame inside the photo and never smaller than 10%", () => {
    expect(clampCrop({ x: 0.95, y: -1, w: 0.5, h: 2 })).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 });
    expect(clampCrop({ x: 0, y: 0, w: 0.01, h: 0.01 })).toEqual({
      x: 0,
      y: 0,
      w: MIN_CROP,
      h: MIN_CROP,
    });
    expect(moveCrop({ x: 0.2, y: 0.2, w: 0.5, h: 0.5 }, 1, -1)).toEqual({
      x: 0.5,
      y: 0,
      w: 0.5,
      h: 0.5,
    });
    expect(resizeCrop({ x: 0.6, y: 0, w: 0.3, h: 0.3 }, 0.5, -0.5)).toEqual({
      x: 0.6,
      y: 0,
      w: 0.4,
      h: MIN_CROP,
    });
  });

  it("turns a frame into whole pixels of the photo", () => {
    expect(cropPixels(FULL_CROP, 1600, 1200)).toEqual({ x: 0, y: 0, width: 1600, height: 1200 });
    expect(cropPixels({ x: 0.25, y: 0.5, w: 0.5, h: 0.5 }, 801, 601)).toEqual({
      x: 200,
      y: 301,
      width: 401,
      height: 300,
    });
  });

  it("sends only the filters that are set", () => {
    expect(filterEntries({})).toEqual([]);
    expect(
      filterEntries({ metal: "GOLD", fineness: 585, minPrice: " ", city: "Bakı", store: "" }),
    ).toEqual([
      ["metal", "GOLD"],
      ["fineness", "585"],
      ["city", "Bakı"],
    ]);
  });

  it("scales the longest side down to 768 px and never up", () => {
    expect(fitSize(4032, 3024)).toEqual({ width: 768, height: 576 });
    expect(fitSize(1080, 1920)).toEqual({ width: 432, height: 768 });
    expect(fitSize(500, 300)).toEqual({ width: 500, height: 300 });
  });
});
