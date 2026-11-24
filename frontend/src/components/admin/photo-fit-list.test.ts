import { describe, expect, it } from "vitest";
import { fittedName } from "./photo-fit-list";

describe("fitted photo file name", () => {
  it("keeps the name and marks the fitted file", () => {
    expect(fittedName("ring-gold-2.jpg", "image/webp")).toBe("ring-gold-2-fit.webp");
    expect(fittedName("IMG_0001.HEIC.png", "image/jpeg")).toBe("IMG_0001.HEIC-fit.jpg");
    expect(fittedName(".png", "image/webp")).toBe("photo-fit.webp");
  });
});
