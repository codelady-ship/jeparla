/**
 * "Fit to design" for product photos, the browser twin of the backend studio look (#119,
 * az.jeparla.ai.studio.StudioComposer; docs/DESIGN.md "Məhsul şəkli standartı"): the item is cut out
 * with a segmentation mask and placed, unchanged in shape, colour and stones, on the site's cream
 * background, centred, about 70% of the product card frame (4:5), with a soft green-toned shadow
 * under it. The only change to the item's own pixels is one global exposure factor (0.92-1.15, the
 * same for all three channels, so the hue is kept); edge pixels lose the colour of the old background.
 * Nothing is generated or redrawn.
 *
 * Pure functions over typed arrays: no canvas, no model (the mask comes from ./segment), so every
 * step is unit-tested in Node. Deterministic for the same input.
 */
import colors from "@/lib/brand-colors.json";

/** Width / height of the product card (`aspect-[4/5]` in product-card.tsx). */
export const CARD_RATIO = 4 / 5;
/**
 * Output size: the demo photos and the seed rows are 800 x 1000, and the largest card on the site
 * is about 360 CSS px wide (25vw at 1440 px), so 800 px covers a 2x screen. next/image makes the
 * smaller widths.
 */
export const FIT_OUTPUT = Object.freeze({ width: 800, height: 1000 });
/** Share of the frame the item fills along its tighter side. */
export const FILL = 0.7;
/** Photos are processed at most this long (enough detail for an 800 px output). */
export const MAX_WORK_SIDE = 1600;
/** Below this share of the photo the mask is treated as "no item found". */
export const MIN_ITEM_SHARE = 0.002;
const SHADOW_OPACITY = 0.22;

export type Rgb = readonly [number, number, number];

/** "#RRGGBB" -> [r, g, b]. */
export function hexToRgb(hex: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a #RRGGBB colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Cream page background (`bg` of docs/design/tokens.json, light theme). */
export const BACKGROUND: Rgb = hexToRgb(colors.light.bg);
/** Shadow tone: the deep brand green (`scene.green`), never black (black looks grey on cream). */
export const SHADOW: Rgb = hexToRgb(colors.scene.green);

export type Box = { x0: number; y0: number; x1: number; y1: number };

/**
 * Cleans the soft mask: faint haze (below 0.08) becomes background, near-certain item (above 0.92)
 * becomes item, and specks far smaller than the largest part (dust, reflections in the old
 * background) are dropped.
 */
export function refine(mask: Float32Array, w: number, h: number): Float32Array {
  const a = new Float32Array(mask.length);
  for (let i = 0; i < mask.length; i++) {
    const v = (mask[i] - 0.08) / 0.84;
    a[i] = v <= 0 ? 0 : v >= 1 ? 1 : v;
  }
  const label = new Int32Array(a.length).fill(-1);
  const sizes: number[] = [];
  const queue = new Int32Array(a.length);
  for (let start = 0; start < a.length; start++) {
    if (a[start] < 0.5 || label[start] >= 0) continue;
    const id = sizes.length;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    label[start] = id;
    while (head < tail) {
      const p = queue[head++];
      const x = p % w;
      const y = (p - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const n = ny * w + nx;
          if (label[n] < 0 && a[n] >= 0.5) {
            label[n] = id;
            queue[tail++] = n;
          }
        }
      }
    }
    sizes.push(tail);
  }
  const largest = sizes.reduce((m, s) => Math.max(m, s), 0);
  const minKeep = Math.max(4, Math.floor(largest / 200));
  for (let i = 0; i < a.length; i++) {
    if (label[i] >= 0 && sizes[label[i]] < minKeep) a[i] = 0;
  }
  return a;
}

/** Bounding box (exclusive end) of the mask at or above `threshold`, or null when too small. */
export function bounds(alpha: Float32Array, w: number, h: number, threshold = 0.5): Box | null {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  let area = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] >= threshold) {
        area++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0 || area < MIN_ITEM_SHARE * w * h) return null;
  return { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

export type Side = "left" | "top" | "right" | "bottom";

/** Whether the item reaches the photo's edge: a few pixels of the outer two rows or columns. */
export function touches(alpha: Float32Array, w: number, h: number, side: Side): boolean {
  const vertical = side === "left" || side === "right";
  const length = vertical ? h : w;
  let hits = 0;
  for (let band = 0; band < 2; band++) {
    for (let i = 0; i < length; i++) {
      const x = side === "left" ? band : side === "right" ? w - 1 - band : i;
      const y = side === "top" ? band : side === "bottom" ? h - 1 - band : i;
      if (alpha[y * w + x] >= 0.5) hits++;
    }
  }
  return hits >= 4;
}

/** Three box blurs (close to a Gaussian) with the given radius. */
export function blur(plane: Float32Array, w: number, h: number, radius: number): Float32Array {
  const a = Float32Array.from(plane);
  const b = new Float32Array(a.length);
  const r = Math.max(1, Math.round(radius));
  const norm = 1 / (2 * r + 1);
  const cx = (x: number) => (x < 0 ? 0 : x >= w ? w - 1 : x);
  const cy = (y: number) => (y < 0 ? 0 : y >= h ? h - 1 : y);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let sum = 0;
      for (let x = -r; x <= r; x++) sum += a[row + cx(x)];
      for (let x = 0; x < w; x++) {
        b[row + x] = sum * norm;
        sum += a[row + cx(x + r + 1)] - a[row + cx(x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += b[cy(y) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = sum * norm;
        sum += b[cy(y + r + 1) * w + x] - b[cy(y - r) * w + x];
      }
    }
  }
  return a;
}

/**
 * Item colour without the old background: an edge pixel is a mix `a*F + (1-a)*B`; B is estimated
 * from the nearby background and F solved. Fully opaque pixels keep their colour.
 * Returns `[r, g, b]` planes in 0..255.
 */
export function decontaminate(
  rgba: Uint8ClampedArray,
  alpha: Float32Array,
  w: number,
  h: number,
): [Float32Array, Float32Array, Float32Array] {
  const n = w * h;
  const rgb: [Float32Array, Float32Array, Float32Array] = [
    new Float32Array(n),
    new Float32Array(n),
    new Float32Array(n),
  ];
  for (let i = 0; i < n; i++) {
    rgb[0][i] = rgba[i * 4];
    rgb[1][i] = rgba[i * 4 + 1];
    rgb[2][i] = rgba[i * 4 + 2];
  }
  const weight = new Float32Array(n);
  for (let i = 0; i < n; i++) weight[i] = 1 - alpha[i];
  const radius = Math.max(2, Math.floor(Math.max(w, h) / 60));
  const weightBlur = blur(weight, w, h, radius);
  for (const plane of rgb) {
    const weighted = new Float32Array(n);
    for (let i = 0; i < n; i++) weighted[i] = plane[i] * weight[i];
    const background = blur(weighted, w, h, radius);
    for (let i = 0; i < n; i++) {
      const a = alpha[i];
      if (a >= 0.999 || a <= 0.01) continue;
      const b = weightBlur[i] > 1e-4 ? background[i] / weightBlur[i] : plane[i];
      const f = (plane[i] - (1 - a) * b) / Math.max(a, 0.15);
      plane[i] = f < 0 ? 0 : f > 255 ? 255 : f;
    }
  }
  return rgb;
}

/**
 * One brightness factor for the whole item: its median luminance moves part of the way towards a
 * common level, limited to 0.92-1.15 so that no photo is changed much.
 */
export function exposureGain(rgb: readonly Float32Array[], alpha: Float32Array): number {
  const histogram = new Uint32Array(256);
  let n = 0;
  for (let i = 0; i < alpha.length; i++) {
    if (alpha[i] >= 0.9) {
      const l = Math.round(0.2126 * rgb[0][i] + 0.7152 * rgb[1][i] + 0.0722 * rgb[2][i]);
      histogram[Math.min(255, Math.max(0, l))]++;
      n++;
    }
  }
  if (n === 0) return 1;
  let seen = 0;
  let median = 0;
  for (let l = 0; l < 256; l++) {
    seen += histogram[l];
    if (seen * 2 >= n) {
      median = l;
      break;
    }
  }
  const gain = Math.sqrt(150 / Math.max(median, 1));
  return Math.max(0.92, Math.min(1.15, gain));
}

export type Placement = {
  /** Item scale from the work photo to the output frame. */
  scale: number;
  /** Centre of the item box in the work photo. */
  source: { x: number; y: number };
  /** Where that centre lands in the output frame. */
  target: { x: number; y: number };
};

/**
 * Where the item goes in a `outW x outH` frame: 70% of the frame along its tighter side, centred
 * (a little above the middle: the shadow below balances it). A chain that runs out of the original
 * photo runs out of the new frame on the same side too, or it would end in mid-air.
 */
export function placement(
  box: Box,
  edges: Record<Side, boolean>,
  outW: number,
  outH: number,
): Placement {
  const bw = box.x1 - box.x0;
  const bh = box.y1 - box.y0;
  const limit = (frame: number, item: number, start: boolean, end: boolean) =>
    (frame * (start && end ? 1 : start || end ? 0.85 : FILL)) / item;
  const anchor = (free: number, frame: number, item: number, start: boolean, end: boolean) => {
    if (start === end) return start ? frame / 2 : free;
    return start ? item / 2 : frame - item / 2;
  };
  const scale = Math.min(
    limit(outW, bw, edges.left, edges.right),
    limit(outH, bh, edges.top, edges.bottom),
  );
  return {
    scale,
    source: { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 },
    target: {
      x: anchor(outW / 2, outW, bw * scale, edges.left, edges.right),
      y: anchor(outH * 0.48, outH, bh * scale, edges.top, edges.bottom),
    },
  };
}

/** Bilinear sample; 0 outside the plane. */
function sample(plane: Float32Array, w: number, h: number, x: number, y: number): number {
  if (x < -0.5 || y < -0.5 || x > w - 0.5 || y > h - 0.5) return 0;
  x = Math.max(0, Math.min(w - 1, x));
  y = Math.max(0, Math.min(h - 1, y));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const wx = x - x0;
  const wy = y - y0;
  const top = plane[y0 * w + x0] * (1 - wx) + plane[y0 * w + x1] * wx;
  const bottom = plane[y1 * w + x0] * (1 - wx) + plane[y1 * w + x1] * wx;
  return top * (1 - wy) + bottom * wy;
}

/** Highlights brightened by the exposure factor roll off softly instead of clipping flat. */
function rollOff(v: number): number {
  return v <= 230 ? v : 230 + 25 * (1 - Math.exp(-(v - 230) / 25));
}

/** The item was not found in the photo (or only specks): no empty frame is returned. */
export class NoItemError extends Error {
  constructor() {
    super("No item found in the photo");
    this.name = "NoItemError";
  }
}

export type ComposeOptions = {
  width?: number;
  height?: number;
  background?: Rgb;
  shadow?: Rgb;
};

/**
 * The whole fit: `rgba` is the work photo (`w x h`, RGBA), `mask` the model's soft mask (0..1, same
 * size). Returns the finished opaque RGBA frame.
 */
export function compose(
  rgba: Uint8ClampedArray,
  mask: Float32Array,
  w: number,
  h: number,
  options: ComposeOptions = {},
): { data: Uint8ClampedArray<ArrayBuffer>; width: number; height: number } {
  if (mask.length !== w * h || rgba.length !== w * h * 4) {
    throw new Error("Mask size does not match the photo");
  }
  const outW = options.width ?? FIT_OUTPUT.width;
  const outH = options.height ?? FIT_OUTPUT.height;
  const bg = options.background ?? BACKGROUND;
  const sh = options.shadow ?? SHADOW;

  const alpha = refine(mask, w, h);
  const box = bounds(alpha, w, h);
  if (!box) throw new NoItemError();
  const fg = decontaminate(rgba, alpha, w, h);
  const gain = exposureGain(fg, alpha);
  const edges = {
    left: touches(alpha, w, h, "left"),
    top: touches(alpha, w, h, "top"),
    right: touches(alpha, w, h, "right"),
    bottom: touches(alpha, w, h, "bottom"),
  };
  const { scale, source, target } = placement(box, edges, outW, outH);

  // Premultiplied, so resampling never mixes in the colour of background pixels.
  const pre = fg.map((plane) => {
    const p = new Float32Array(plane.length);
    for (let i = 0; i < p.length; i++) p[i] = plane[i] * alpha[i];
    return p;
  });
  const a = new Float32Array(outW * outH);
  const c = [0, 1, 2].map(() => new Float32Array(outW * outH));
  for (let y = 0; y < outH; y++) {
    const sy = (y + 0.5 - target.y) / scale + source.y - 0.5;
    for (let x = 0; x < outW; x++) {
      const sx = (x + 0.5 - target.x) / scale + source.x - 0.5;
      const i = y * outW + x;
      a[i] = sample(alpha, w, h, sx, sy);
      if (a[i] > 1e-4) {
        for (let ch = 0; ch < 3; ch++) c[ch][i] = (sample(pre[ch], w, h, sx, sy) / a[i]) * gain;
      }
    }
  }
  // Soft shadow: the item's own silhouette, blurred and a little lower.
  const shadow = blur(a, outW, outH, Math.max(3, Math.floor(outW / 70)));
  const drop = Math.max(2, Math.floor(outH / 90));
  const data = new Uint8ClampedArray(outW * outH * 4);
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const i = y * outW + x;
      const s = y - drop >= 0 ? shadow[(y - drop) * outW + x] * SHADOW_OPACITY : 0;
      for (let ch = 0; ch < 3; ch++) {
        const base = bg[ch] + (sh[ch] - bg[ch]) * s;
        data[i * 4 + ch] = Math.round(base * (1 - a[i]) + rollOff(c[ch][i]) * a[i]);
      }
      data[i * 4 + 3] = 255;
    }
  }
  return { data, width: outW, height: outH };
}

/** Size of the work photo: the longest side at most `max`, never enlarged. */
export function workSize(width: number, height: number, max = MAX_WORK_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height, 1));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
