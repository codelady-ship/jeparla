/**
 * The short product video (#117). Same limits as the API's MerchantVideoService, which checks the
 * stored file again (container, codec, duration, size); these only save the seller a wasted upload.
 */
export const VIDEO_TYPES = ["video/mp4", "video/webm"] as const;
export type VideoType = (typeof VIDEO_TYPES)[number];
export const VIDEO_MAX_BYTES = 8 * 1024 * 1024;
export const VIDEO_MAX_SECONDS = 15;
/** A phone that stops at "15 seconds" writes a few frames more; the API allows the same slack. */
const VIDEO_MAX_MS = VIDEO_MAX_SECONDS * 1000 + 500;

export const isVideoType = (type: string): type is VideoType =>
  (VIDEO_TYPES as readonly string[]).includes(type);

/** The video of a product as the cabinet sees it (MerchantVideo of the API). */
export type MerchantVideo = {
  url: string;
  contentType: VideoType;
  sizeBytes: number;
  durationMs: number;
  width: number;
  height: number;
  aiGenerated: boolean;
};

/** Why a picked file cannot be a product video, before anything is sent; null when it may be. */
export function videoProblem(
  file: { type: string; size: number },
  durationSeconds: number | null,
): "badType" | "tooBig" | "tooLong" | null {
  if (!isVideoType(file.type)) return "badType";
  if (file.size > VIDEO_MAX_BYTES) return "tooBig";
  // A browser that cannot read the duration leaves the decision to the API.
  if (durationSeconds !== null && durationSeconds * 1000 > VIDEO_MAX_MS) return "tooLong";
  return null;
}

/** "0:09" for a clip of 9.4 seconds. */
export function clipLength(durationMs: number): string {
  const seconds = Math.max(1, Math.round(durationMs / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
