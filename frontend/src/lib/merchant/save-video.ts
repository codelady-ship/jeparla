import { ApiError } from "@/lib/api/http";
import { userFetch } from "@/lib/auth/backend";
import type { ImageUpload } from "./backend";
import type { MerchantVideo, VideoType } from "./video";

/**
 * Sends the video of a product to the backend from a route handler (#117), like a photo in
 * saveProduct: a presigned upload into private staging, the file itself, then "set", where the
 * API checks the stored file (MP4 with H.264 or WebM, at most 15 s and 8 MB) and publishes it.
 * Every call carries the seller's token; the backend checks that the product is theirs.
 */
export async function saveVideo(
  productId: number,
  file: { type: VideoType; bytes: Uint8Array },
  aiGenerated: boolean,
  locale: string,
): Promise<MerchantVideo> {
  const call = <T>(path: string, options: Parameters<typeof userFetch>[1] = {}) =>
    userFetch<T>(path, { canRefresh: true, locale, ...options });
  const upload = await call<ImageUpload>(`/merchant/products/${productId}/video/uploads`, {
    method: "POST",
    body: { contentType: file.type, sizeBytes: file.bytes.byteLength },
  });
  const put = await fetch(upload.url, {
    method: upload.method || "PUT",
    headers: upload.headers,
    body: new Blob([file.bytes as Uint8Array<ArrayBuffer>], { type: file.type }),
    signal: AbortSignal.timeout(60_000),
  }).catch(() => null);
  if (!put?.ok) throw new ApiError(502, "PUT video upload", "storage.upload_failed");
  return call<MerchantVideo>(`/merchant/products/${productId}/video`, {
    method: "PUT",
    body: { key: upload.key, aiGenerated },
  });
}

export async function removeVideo(productId: number, locale: string): Promise<void> {
  await userFetch(`/merchant/products/${productId}/video`, {
    method: "DELETE",
    canRefresh: true,
    locale,
  });
}
