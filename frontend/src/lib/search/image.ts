/** Search by photo (#163): browser-side preparation of the buyer's photo. */

/** Same limit as the API (ImageSearchService.MAX_BYTES). */
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
/** Longest side sent to the API; enough for the embedding model, small on mobile data. */
export const IMAGE_MAX_SIDE = 768;
/** Picker filter; HEIC is decoded where the browser can (Safari), otherwise "could not be read". */
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

/** JPEG, PNG or WebP by the first bytes (the API checks again). */
export function isImageMagic(b: Uint8Array): boolean {
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const webp =
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50;
  return jpeg || png || webp;
}

/** Size that fits `max` on the longest side, never enlarged. */
export function fitSize(width: number, height: number, max = IMAGE_MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height, 1));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Decodes the photo, scales it to `max` (default {@link IMAGE_MAX_SIDE}) and encodes a new
 * JPEG. Re-encoding drops EXIF (location, device). Null when the browser cannot read it.
 */
export async function preparePhoto(file: Blob, max = IMAGE_MAX_SIDE): Promise<Blob | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
  const { width, height } = fitSize(bitmap.width, bitmap.height, max);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85));
}

/** Longest side of the copy the buyer frames before searching (cropping keeps detail, then 768 px). */
export const IMAGE_EDIT_SIDE = 1600;

/** Part of the photo to search, as fractions of its width and height (0..1). */
export type CropRect = { x: number; y: number; w: number; h: number };

/** The whole photo. */
export const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };

/** Smallest frame side, as a fraction: the item must stay recognisable. */
export const MIN_CROP = 0.1;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Keeps the frame inside the photo and at least {@link MIN_CROP} wide and high. */
export function clampCrop(c: CropRect): CropRect {
  const w = clamp(c.w, MIN_CROP, 1);
  const h = clamp(c.h, MIN_CROP, 1);
  return { x: clamp(c.x, 0, 1 - w), y: clamp(c.y, 0, 1 - h), w, h };
}

/** Moves the frame by (dx, dy), staying inside the photo. */
export function moveCrop(c: CropRect, dx: number, dy: number): CropRect {
  return clampCrop({ ...c, x: c.x + dx, y: c.y + dy });
}

/** Grows or shrinks the frame by (dw, dh) from its top left corner, staying inside the photo. */
export function resizeCrop(c: CropRect, dw: number, dh: number): CropRect {
  const w = clamp(c.w + dw, MIN_CROP, 1 - c.x);
  const h = clamp(c.h + dh, MIN_CROP, 1 - c.y);
  return { ...c, w, h };
}

/** Pixel rectangle of a crop on an image of the given size (at least 1 px). */
export function cropPixels(c: CropRect, width: number, height: number) {
  const x = Math.round(c.x * width);
  const y = Math.round(c.y * height);
  return {
    x,
    y,
    width: Math.max(1, Math.min(width - x, Math.round(c.w * width))),
    height: Math.max(1, Math.min(height - y, Math.round(c.h * height))),
  };
}

/**
 * The framed part of an already prepared photo, scaled to {@link IMAGE_MAX_SIDE} and
 * encoded as a new JPEG. Null when the browser cannot read it.
 */
export async function cropPhoto(photo: Blob, crop: CropRect): Promise<Blob | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(photo);
  } catch {
    return null;
  }
  const area = cropPixels(clampCrop(crop), bitmap.width, bitmap.height);
  const { width, height } = fitSize(area.width, area.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, area.x, area.y, area.width, area.height, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85));
}

/** Result filters of search by photo; the same meaning as the catalog filters. */
export type PhotoFilters = {
  category?: string;
  metal?: string;
  fineness?: number;
  minPrice?: string;
  maxPrice?: string;
  store?: string;
  city?: string;
};

/** Field names the photo search route forwards to the API. */
export const FILTER_FIELDS = [
  "category",
  "metal",
  "fineness",
  "minPrice",
  "maxPrice",
  "store",
  "city",
] as const satisfies readonly (keyof PhotoFilters)[];

/** Filters as form fields of POST /api/v1/search/image; empty values are left out. */
export function filterEntries(f: PhotoFilters): [string, string][] {
  const out: [string, string][] = [];
  for (const key of FILTER_FIELDS) {
    const value = f[key];
    if (value === undefined) continue;
    const text = String(value).trim();
    if (text) out.push([key, text]);
  }
  return out;
}
