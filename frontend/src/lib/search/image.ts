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
 * Decodes the photo, scales it to {@link IMAGE_MAX_SIDE} and encodes a new JPEG.
 * Re-encoding drops EXIF (location, device). Null when the browser cannot read it.
 */
export async function preparePhoto(file: Blob): Promise<Blob | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
  const { width, height } = fitSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85));
}
