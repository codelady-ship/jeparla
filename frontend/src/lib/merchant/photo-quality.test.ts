import { describe, expect, it } from "vitest";
import { measurePixels, photoWarnings } from "./photo-quality";

function image(w: number, h: number, pixel: (x: number, y: number) => number) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = pixel(x, y);
      data.set([v, v, v, 255], (y * w + x) * 4);
    }
  }
  return data;
}

describe("photo quality hints (#119)", () => {
  it("measures brightness and sharpness", () => {
    const flat = measurePixels(
      image(32, 32, () => 200),
      32,
      32,
    );
    expect(flat.brightness).toBeCloseTo(200, 0);
    expect(flat.sharpness).toBe(0);
    const checker = measurePixels(
      image(32, 32, (x, y) => ((x + y) % 2 ? 255 : 0)),
      32,
      32,
    );
    expect(checker.sharpness).toBeGreaterThan(1000);
  });

  it("warns about small, dark and blurry photos only", () => {
    expect(photoWarnings({ width: 1600, height: 2000, brightness: 150, sharpness: 300 })).toEqual(
      [],
    );
    expect(photoWarnings({ width: 640, height: 480, brightness: 30, sharpness: 5 })).toEqual([
      "small",
      "dark",
      "blurry",
    ]);
  });
});
