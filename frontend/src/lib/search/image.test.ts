import { describe, expect, it } from "vitest";
import { fitSize, isImageMagic } from "./image";

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

  it("scales the longest side down to 768 px and never up", () => {
    expect(fitSize(4032, 3024)).toEqual({ width: 768, height: 576 });
    expect(fitSize(1080, 1920)).toEqual({ width: 432, height: 768 });
    expect(fitSize(500, 300)).toEqual({ width: 500, height: 300 });
  });
});
