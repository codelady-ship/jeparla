export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const IMAGE_MAX_BYTES = 15 * 1024 * 1024;
/** Longest side after downscaling; enough for the catalog and small for the draft. */
const MAX_SIDE = 960;

/**
 * Phone photos are large; this shrinks one to a JPEG data URL so the draft fits
 * in localStorage. The backend upload (R2, PLAN 5.13) replaces it on Day 6 and
 * checks MIME type and size again on the server.
 */
export async function downscale(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.8);
}

/** Moves item `from` to index `to` (photo order; the first one is the cover). */
export function move<T>(list: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
