/**
 * Photo quality hints of the product form (#119): too small, too dark or blurry.
 * Only warnings: the seller decides. Measured on a small copy in the browser,
 * nothing is sent anywhere.
 */

export type PhotoWarning = "small" | "dark" | "blurry";

/** Shorter side below this looks soft on a retina product page. */
export const MIN_SIDE = 800;
/** Mean luma (0-255) below this reads as "too dark". */
export const DARK_LUMA = 60;
/** Variance of the Laplacian on the 256 px sample below this reads as "blurry". */
export const BLUR_VARIANCE = 40;
const SAMPLE = 256;

export type PhotoMeasure = {
  width: number;
  height: number;
  /** Mean luma 0-255. */
  brightness: number;
  /** Variance of the 4-neighbour Laplacian of the luma. */
  sharpness: number;
};

/** Brightness and sharpness of RGBA pixels (row-major, `width` x `height`). */
export function measurePixels(data: Uint8ClampedArray, width: number, height: number) {
  const luma = new Float32Array(width * height);
  let sum = 0;
  for (let i = 0; i < width * height; i++) {
    const y = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    luma[i] = y;
    sum += y;
  }
  let n = 0;
  let mean = 0;
  let m2 = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = luma[i - 1] + luma[i + 1] + luma[i - width] + luma[i + width] - 4 * luma[i];
      // Welford: one pass, no array of Laplacian values.
      n++;
      const d = lap - mean;
      mean += d / n;
      m2 += d * (lap - mean);
    }
  }
  return {
    brightness: width * height ? sum / (width * height) : 0,
    sharpness: n > 1 ? m2 / (n - 1) : 0,
  };
}

export function photoWarnings(m: PhotoMeasure): PhotoWarning[] {
  const warnings: PhotoWarning[] = [];
  if (Math.min(m.width, m.height) < MIN_SIDE) warnings.push("small");
  if (m.brightness < DARK_LUMA) warnings.push("dark");
  if (m.sharpness < BLUR_VARIANCE) warnings.push("blurry");
  return warnings;
}

/** Warnings for a picked file; empty when the browser cannot decode it (the upload reports that). */
export async function checkPhoto(file: Blob): Promise<PhotoWarning[]> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return [];
  }
  const scale = Math.min(1, SAMPLE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(3, Math.round(bitmap.width * scale));
  const h = Math.max(3, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(bitmap, 0, 0, w, h);
  const { width, height } = bitmap;
  bitmap.close();
  const measured = measurePixels(ctx.getImageData(0, 0, w, h).data, w, h);
  return photoWarnings({ width, height, ...measured });
}
