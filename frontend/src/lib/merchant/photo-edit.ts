/**
 * Rotate and crop a draft photo in the browser before upload (#129). Canvas only, no library:
 * the seller cabinet stays small. The pure {@link plan} is tested; {@link applyEdit} draws it.
 */

export type Rotation = 0 | 90 | 180 | 270;
export type CropPreset = "original" | "square" | "portrait";
export type PhotoEdit = { rotate: Rotation; crop: CropPreset };

export const NO_EDIT: PhotoEdit = Object.freeze({ rotate: 0, crop: "original" }) as PhotoEdit;
export const CROP_PRESETS: readonly CropPreset[] = ["original", "square", "portrait"];
/** Longest side of an edited photo; plenty for the catalog, small on mobile data. */
export const EDIT_MAX_SIDE = 2400;
/** Width / height of the "portrait" (4:5) preset. */
const PORTRAIT = 4 / 5;

export function isNoEdit(e: PhotoEdit): boolean {
  return e.rotate === 0 && e.crop === "original";
}

/** Rotates 90 degrees left (-1) or right (+1). */
export function turn(e: PhotoEdit, dir: -1 | 1): PhotoEdit {
  return { ...e, rotate: ((((e.rotate + dir * 90) % 360) + 360) % 360) as Rotation };
}

export type EditPlan = {
  /** Size after rotation, before the crop. */
  rotated: { width: number; height: number };
  /** Centered crop in rotated coordinates. */
  crop: { x: number; y: number; width: number; height: number };
  /** Output canvas size: the crop scaled to fit `maxSide`, never enlarged. */
  out: { width: number; height: number };
};

/** Where to cut and how large to draw for a `width` x `height` photo. */
export function plan(width: number, height: number, edit: PhotoEdit, maxSide = EDIT_MAX_SIDE) {
  const quarter = edit.rotate === 90 || edit.rotate === 270;
  const rw = Math.max(1, quarter ? height : width);
  const rh = Math.max(1, quarter ? width : height);
  let cw = rw;
  let ch = rh;
  if (edit.crop === "square") cw = ch = Math.min(rw, rh);
  else if (edit.crop === "portrait") {
    if (rw / rh > PORTRAIT) cw = Math.round(rh * PORTRAIT);
    else ch = Math.round(rw / PORTRAIT);
  }
  const scale = Math.min(1, maxSide / Math.max(cw, ch));
  const result: EditPlan = {
    rotated: { width: rw, height: rh },
    crop: { x: Math.floor((rw - cw) / 2), y: Math.floor((rh - ch) / 2), width: cw, height: ch },
    out: {
      width: Math.max(1, Math.round(cw * scale)),
      height: Math.max(1, Math.round(ch * scale)),
    },
  };
  return result;
}

/**
 * Draws the edited photo and encodes a JPEG (EXIF, such as location, is dropped). The photo is
 * read with its EXIF orientation applied, so "rotate" starts from what the seller sees.
 * Null when the browser cannot read the photo.
 */
export async function applyEdit(
  file: Blob,
  edit: PhotoEdit,
  maxSide = EDIT_MAX_SIDE,
  quality = 0.9,
): Promise<Blob | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
  const p = plan(bitmap.width, bitmap.height, edit, maxSide);
  const canvas = document.createElement("canvas");
  canvas.width = p.out.width;
  canvas.height = p.out.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return null;
  }
  ctx.imageSmoothingQuality = "high";
  ctx.scale(p.out.width / p.crop.width, p.out.height / p.crop.height);
  ctx.translate(-p.crop.x, -p.crop.y);
  ctx.translate(p.rotated.width / 2, p.rotated.height / 2);
  ctx.rotate((edit.rotate * Math.PI) / 180);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", quality));
}
