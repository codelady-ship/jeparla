import { apiFetch } from "@/lib/api/http";
import { dataUrlBytes, type ImageUpload } from "@/lib/merchant/backend";
import type { SignupPhoto } from "./schemas";

type Call = <T>(path: string, options?: Parameters<typeof apiFetch>[1]) => Promise<T>;

/**
 * Uploads the /sell step 4 photos (#317) right after the account and the store exist (before
 * that there is no store to own them). With a first product they become its photos, in the
 * seller's order; without one (bijouterie, or a skipped product) each photo becomes a private
 * photo draft in the cabinet (#129), where the seller finishes the product. The same presigned
 * staging upload as the product form; the API checks type, size and ownership again.
 * Returns how many photos were kept; one that fails is skipped, the rest still go.
 */
export async function uploadSignupPhotos(
  call: Call,
  photos: readonly SignupPhoto[],
  productId: number | null,
  altAz: string,
): Promise<number> {
  let saved = 0;
  const order: number[] = [];
  for (const photo of photos) {
    const file = dataUrlBytes(photo.url);
    if (!file) continue;
    try {
      const upload = await call<ImageUpload>(
        productId === null
          ? "/merchant/drafts/uploads"
          : `/merchant/products/${productId}/images/uploads`,
        {
          method: "POST",
          body:
            productId === null
              ? { kind: "PHOTO", contentType: file.type, sizeBytes: file.bytes.byteLength }
              : { contentType: file.type, sizeBytes: file.bytes.byteLength },
        },
      );
      const put = await fetch(upload.url, {
        method: upload.method || "PUT",
        headers: upload.headers,
        body: new Blob([file.bytes as Uint8Array<ArrayBuffer>], { type: file.type }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!put.ok) throw new Error(`photo upload ${put.status}`);
      if (productId === null) {
        await call("/merchant/drafts", {
          method: "POST",
          body: { key: upload.key, kind: "PHOTO" },
        });
      } else {
        const attached = await call<{ id: number }>(`/merchant/products/${productId}/images`, {
          method: "POST",
          body: { key: upload.key, altAz: altAz.trim().slice(0, 200) },
        });
        order.push(attached.id);
      }
      saved++;
    } catch (e) {
      console.error("Seller wizard: photo not saved", e);
    }
  }
  if (order.length > 1) {
    await call(`/merchant/products/${productId}/images/order`, {
      method: "PUT",
      body: { imageIds: order },
    }).catch((e: unknown) => console.error("Seller wizard: photo order not saved", e));
  }
  return saved;
}
