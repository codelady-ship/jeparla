/**
 * Input and output of the segmentation model, as pure functions (tested in Node). The same
 * pre- and post-processing as the backend (az.jeparla.ai.studio.OnnxSegmenter) and the model
 * authors: the photo is resized to the square input, divided by its brightest channel value,
 * normalised with the ImageNet mean and std; the mask is stretched to 0..1 and scaled back.
 */

/** U2-Net-p (Apache-2.0, 4.6 MB): the same file the backend pins (SegmentationModel.U2NETP). */
export const MODEL = Object.freeze({
  url: "/models/u2netp.onnx",
  sha256: "309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8",
  size: 320,
  mean: [0.485, 0.456, 0.406] as const,
  std: [0.229, 0.224, 0.225] as const,
});

/** RGBA of a `size x size` image -> CHW float tensor data (1 x 3 x size x size). */
export function toTensor(
  rgba: Uint8ClampedArray,
  size: number,
  mean: readonly number[] = MODEL.mean,
  std: readonly number[] = MODEL.std,
): Float32Array {
  const plane = size * size;
  if (rgba.length !== plane * 4) throw new Error("Input is not size x size RGBA");
  let max = 1e-6;
  for (let i = 0; i < plane; i++) {
    const m = Math.max(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]) / 255;
    if (m > max) max = m;
  }
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) {
      out[c * plane + i] = (rgba[i * 4 + c] / 255 / max - mean[c]) / std[c];
    }
  }
  return out;
}

/** Stretches a mask to 0..1 (min-max), as the model authors do. */
export function normalize(mask: Float32Array): Float32Array {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of mask) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const range = Math.max(hi - lo, 1e-6);
  const out = new Float32Array(mask.length);
  for (let i = 0; i < mask.length; i++) out[i] = (mask[i] - lo) / range;
  return out;
}

/** Bilinear resize of a `size x size` mask to `width x height`. */
export function upscale(mask: Float32Array, size: number, width: number, height: number) {
  const out = new Float32Array(width * height);
  const sx = size / width;
  const sy = size / height;
  for (let y = 0; y < height; y++) {
    const fy = Math.max(0, (y + 0.5) * sy - 0.5);
    const y0 = Math.min(Math.floor(fy), size - 1);
    const y1 = Math.min(y0 + 1, size - 1);
    const wy = fy - y0;
    for (let x = 0; x < width; x++) {
      const fx = Math.max(0, (x + 0.5) * sx - 0.5);
      const x0 = Math.min(Math.floor(fx), size - 1);
      const x1 = Math.min(x0 + 1, size - 1);
      const wx = fx - x0;
      const top = mask[y0 * size + x0] * (1 - wx) + mask[y0 * size + x1] * wx;
      const bottom = mask[y1 * size + x0] * (1 - wx) + mask[y1 * size + x1] * wx;
      out[y * width + x] = top * (1 - wy) + bottom * wy;
    }
  }
  return out;
}

/** Lower-case hex SHA-256 of the bytes (Web Crypto; Node has it too). */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
