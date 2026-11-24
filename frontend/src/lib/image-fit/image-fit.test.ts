import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import colors from "@/lib/brand-colors.json";
import {
  BACKGROUND,
  blur,
  bounds,
  compose,
  exposureGain,
  FILL,
  FIT_OUTPUT,
  hexToRgb,
  NoItemError,
  placement,
  refine,
  SHADOW,
  touches,
  workSize,
} from "./compose";
import { MODEL, normalize, sha256Hex, toTensor, upscale } from "./tensor";

/** A `w x h` photo of one colour with a `fg` rectangle, and its exact mask. */
function scene(
  w: number,
  h: number,
  rect: { x0: number; y0: number; x1: number; y1: number },
  fg: [number, number, number] = [200, 160, 80],
  bg: [number, number, number] = [255, 255, 255],
) {
  const rgba = new Uint8ClampedArray(w * h * 4);
  const mask = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const inside = x >= rect.x0 && x < rect.x1 && y >= rect.y0 && y < rect.y1;
      const c = inside ? fg : bg;
      rgba.set([c[0], c[1], c[2], 255], i * 4);
      mask[i] = inside ? 1 : 0;
    }
  }
  return { rgba, mask };
}

const px = (data: Uint8ClampedArray, w: number, x: number, y: number) =>
  Array.from(data.subarray((y * w + x) * 4, (y * w + x) * 4 + 4));

describe("design colours", () => {
  it("come from the tokens: cream background, deep green shadow", () => {
    expect(BACKGROUND).toEqual(hexToRgb(colors.light.bg));
    expect(SHADOW).toEqual(hexToRgb(colors.scene.green));
    expect(hexToRgb("#F7F3EA")).toEqual([247, 243, 234]);
    expect(() => hexToRgb("cream")).toThrow();
  });

  it("output has the product card ratio (4:5)", () => {
    expect(FIT_OUTPUT.width / FIT_OUTPUT.height).toBe(4 / 5);
  });
});

describe("mask clean-up", () => {
  it("drops haze and specks, keeps the item", () => {
    const w = 100;
    const h = 100;
    const { mask } = scene(w, h, { x0: 20, y0: 20, x1: 80, y1: 80 });
    mask[5 * w + 5] = 1; // a speck of dust
    mask[95 * w + 95] = 0.05; // haze
    const a = refine(mask, w, h);
    expect(a[50 * w + 50]).toBe(1);
    expect(a[5 * w + 5]).toBe(0);
    expect(a[95 * w + 95]).toBe(0);
  });

  it("finds the bounding box, or none for an empty mask", () => {
    const { mask } = scene(50, 40, { x0: 10, y0: 5, x1: 30, y1: 25 });
    expect(bounds(mask, 50, 40)).toEqual({ x0: 10, y0: 5, x1: 30, y1: 25 });
    expect(bounds(new Float32Array(50 * 40), 50, 40)).toBeNull();
  });

  it("knows which photo edges the item leaves through", () => {
    const { mask } = scene(40, 40, { x0: 0, y0: 10, x1: 20, y1: 30 });
    expect(touches(mask, 40, 40, "left")).toBe(true);
    expect(touches(mask, 40, 40, "right")).toBe(false);
    expect(touches(mask, 40, 40, "top")).toBe(false);
  });

  it("blur keeps a flat plane flat and spreads an edge", () => {
    const flat = new Float32Array(30 * 30).fill(0.4);
    expect(blur(flat, 30, 30, 3).every((v) => Math.abs(v - 0.4) < 1e-5)).toBe(true);
    const { mask } = scene(30, 30, { x0: 15, y0: 0, x1: 30, y1: 30 });
    const b = blur(mask, 30, 30, 2);
    expect(b[15 * 30 + 14]).toBeGreaterThan(0);
    expect(b[15 * 30 + 14]).toBeLessThan(1);
  });
});

describe("placement", () => {
  const free = { left: false, top: false, right: false, bottom: false };

  it("fills 70% of the tighter side and sits a little above the middle", () => {
    const p = placement({ x0: 0, y0: 0, x1: 100, y1: 100 }, free, 800, 1000);
    expect(p.scale).toBeCloseTo((800 * FILL) / 100);
    expect(p.target).toEqual({ x: 400, y: 480 });
  });

  it("keeps a chain that leaves the photo at the top running out of the frame", () => {
    const p = placement({ x0: 0, y0: 0, x1: 100, y1: 200 }, { ...free, top: true }, 800, 1000);
    expect(p.target.y).toBeCloseTo((200 * p.scale) / 2);
  });
});

describe("exposure", () => {
  it("is one factor within 0.92-1.15", () => {
    const n = 10;
    const alpha = new Float32Array(n).fill(1);
    const dark = [0, 1, 2].map(() => new Float32Array(n).fill(40));
    const bright = [0, 1, 2].map(() => new Float32Array(n).fill(250));
    expect(exposureGain(dark, alpha)).toBe(1.15);
    expect(exposureGain(bright, alpha)).toBe(0.92);
    expect(exposureGain(dark, new Float32Array(n))).toBe(1);
  });
});

describe("compose", () => {
  it("puts the item on cream, centred, at the card size, colour kept", () => {
    const w = 120;
    const h = 90;
    const { rgba, mask } = scene(w, h, { x0: 40, y0: 30, x1: 80, y1: 60 }, [150, 150, 150]);
    const out = compose(rgba, mask, w, h, { width: 80, height: 100 });
    expect(out.width).toBe(80);
    expect(out.height).toBe(100);
    // The corner is the cream background (no shadow reaches it), fully opaque.
    expect(px(out.data, 80, 0, 0)).toEqual([...BACKGROUND, 255]);
    // The centre is the item; grey 150 needs no exposure change (gain = 1).
    expect(px(out.data, 80, 40, 48)).toEqual([150, 150, 150, 255]);
    // The white of the old background is gone everywhere.
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i] === 255 && out.data[i + 1] === 255 && out.data[i + 2] === 255).toBe(false);
    }
  });

  it("casts a soft shadow below the item", () => {
    const { rgba, mask } = scene(60, 60, { x0: 20, y0: 20, x1: 40, y1: 40 }, [150, 150, 150]);
    const out = compose(rgba, mask, 60, 60, { width: 80, height: 100 });
    // Find the last item row in the centre column, then look just below it.
    let last = 0;
    for (let y = 0; y < 100; y++) if (px(out.data, 80, 40, y)[0] === 150) last = y;
    const below = px(out.data, 80, 40, last + 3);
    expect(below[0]).toBeLessThan(BACKGROUND[0]);
    expect(below[0]).toBeGreaterThan(SHADOW[0]);
  });

  it("refuses a photo with no item", () => {
    const { rgba } = scene(40, 40, { x0: 0, y0: 0, x1: 0, y1: 0 });
    expect(() => compose(rgba, new Float32Array(1600), 40, 40)).toThrow(NoItemError);
    expect(() => compose(rgba, new Float32Array(10), 40, 40)).toThrow(/size/);
  });
});

describe("work size", () => {
  it("shrinks long photos and never enlarges", () => {
    expect(workSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(workSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe("model input and output", () => {
  it("normalises like the backend: divide by the brightest value, then mean and std", () => {
    const rgba = new Uint8ClampedArray([
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 0, 0, 0, 255,
    ]);
    const t = toTensor(rgba, 2);
    expect(t).toHaveLength(12);
    expect(t[0]).toBeCloseTo((1 - MODEL.mean[0]) / MODEL.std[0]);
    expect(t[1]).toBeCloseTo((0 - MODEL.mean[0]) / MODEL.std[0]);
    expect(t[4 + 1]).toBeCloseTo((1 - MODEL.mean[1]) / MODEL.std[1]);
    expect(() => toTensor(rgba, 3)).toThrow();
  });

  it("stretches the mask to 0..1 and scales it up", () => {
    expect(Array.from(normalize(Float32Array.from([0.2, 0.4, 0.6])))).toEqual([
      0,
      expect.closeTo(0.5),
      1,
    ]);
    const big = upscale(Float32Array.from([0, 1, 0, 1]), 2, 4, 4);
    expect(big).toHaveLength(16);
    expect(big[0]).toBe(0);
    expect(big[3]).toBe(1);
  });

  it("the shipped model file is the one the backend pins", async () => {
    const file = readFileSync(resolve(__dirname, "../../../public/models/u2netp.onnx"));
    const bytes = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    expect(await sha256Hex(bytes as ArrayBuffer)).toBe(MODEL.sha256);
  });
});
