import { api } from "@/lib/api";
import { ApiError } from "@/lib/api/http";
import { userFetch } from "@/lib/auth/backend";
import type { ProductStatus } from "@/types/api";
import { EVIDENCE_KINDS, type ProductInput } from "@/types/merchant";
import {
  backendImageId,
  dataUrlBytes,
  draftImageId,
  toProductRequest,
  type BackendProduct,
  type ImageUpload,
} from "./backend";

/** Whether the on-model job of a picked model was queued (#315). */
export type OnModelStart = "queued" | "not_started";

/**
 * Saves the product form to the backend from a route handler: create or update, then the
 * photos (new ones go through a presigned upload into private staging and are attached, i.e.
 * checked and published by the API; removed ones are deleted; the order is the form's), then
 * "send to review" when asked. Every call carries the seller's token; the backend checks
 * ownership and the status rules.
 */
export async function saveProduct(
  intent: "DRAFT" | "REVIEW",
  input: ProductInput,
  id: number | null,
  locale: string,
): Promise<{ id: number; status: ProductStatus; onModel?: OnModelStart }> {
  const call = <T>(path: string, options: Parameters<typeof userFetch>[1] = {}) =>
    userFetch<T>(path, { canRefresh: true, locale, ...options });
  const categories = await api.listCategories();
  const existing = id === null ? null : await call<BackendProduct>(`/merchant/products/${id}`);
  const body = toProductRequest(input, categories, existing);
  const saved =
    id === null
      ? await call<BackendProduct>("/merchant/products", {
          method: "POST",
          body,
          headers: { "Idempotency-Key": crypto.randomUUID() },
        })
      : await call<BackendProduct>(`/merchant/products/${id}`, { method: "PUT", body });

  /** Presigned upload into private staging, then the file itself; returns the upload key. */
  const putFile = async (path: string, file: { type: string; bytes: Uint8Array }) => {
    const upload = await call<ImageUpload>(path, {
      method: "POST",
      body: { contentType: file.type, sizeBytes: file.bytes.byteLength },
    });
    const put = await fetch(upload.url, {
      method: upload.method || "PUT",
      headers: upload.headers,
      body: new Blob([file.bytes as Uint8Array<ArrayBuffer>], { type: file.type }),
      signal: AbortSignal.timeout(30_000),
    }).catch(() => null);
    if (!put?.ok) throw new ApiError(502, "PUT image upload", "storage.upload_failed");
    return upload;
  };

  // Photos. The picked AI model (#315) goes with every new photo; the API acts on it only for the
  // product's first original photo and queues the on-model image after that photo is saved.
  const tryOn = input.tryOnModelId ? { tryOnModelId: input.tryOnModelId } : {};
  const keep = new Set(input.images.map((img) => backendImageId(img.id)).filter((v) => v !== null));
  for (const img of saved.images) {
    if (!keep.has(img.id))
      await call(`/merchant/products/${saved.id}/images/${img.id}`, { method: "DELETE" });
  }
  const order: number[] = [];
  for (const img of input.images) {
    const stored = backendImageId(img.id);
    if (stored !== null) {
      order.push(stored);
      continue;
    }
    // A photo from a draft (#109) is already in private storage: the API copies it over.
    const draftId = draftImageId(img.id);
    if (draftId !== null) {
      const attached = await call<{ id: number }>(
        `/merchant/products/${saved.id}/images/from-draft`,
        { method: "POST", body: { draftId, altAz: input.name.trim().slice(0, 200), ...tryOn } },
      );
      order.push(attached.id);
      continue;
    }
    const file = dataUrlBytes(img.url);
    if (!file) continue;
    const upload = await putFile(`/merchant/products/${saved.id}/images/uploads`, file);
    const attached = await call<{ id: number }>(`/merchant/products/${saved.id}/images`, {
      method: "POST",
      body: { key: upload.key, altAz: input.name.trim().slice(0, 200), ...tryOn },
    });
    order.push(attached.id);
  }
  if (order.length > 1)
    await call(`/merchant/products/${saved.id}/images/order`, {
      method: "PUT",
      body: { imageIds: order },
    });

  // Hallmark and label photos (#106): a new one replaces the stored one and waits for the
  // admin check; a removed one is deleted. Bijouterie has no hallmark (the API refuses it).
  const stored = new Map((saved.evidencePhotos ?? []).map((e) => [e.kind, e]));
  for (const kind of EVIDENCE_KINDS) {
    const wanted =
      kind === "HALLMARK" && saved.materialKind === "FASHION" ? undefined : input.evidence?.[kind];
    if (!wanted) {
      if (stored.has(kind))
        await call(`/merchant/products/${saved.id}/evidence/${kind}`, { method: "DELETE" });
      continue;
    }
    const file = dataUrlBytes(wanted.url);
    if (!file) continue;
    const upload = await putFile(`/merchant/products/${saved.id}/evidence/${kind}/uploads`, file);
    await call(`/merchant/products/${saved.id}/evidence/${kind}`, {
      method: "PUT",
      body: { key: upload.key },
    });
  }

  // With a picked model (#315) the API queued the on-model job while attaching the first photo,
  // unless the quota, the budget, the model or the audience said no: say which, not nothing.
  let onModel: OnModelStart | undefined;
  if (input.tryOnModelId) {
    const jobs = await call<{ kind: string }[]>("/merchant/ai/jobs", {
      query: { productId: saved.id },
    }).catch(() => null);
    onModel = jobs?.some((j) => j.kind === "VIRTUAL_TRY_ON") ? "queued" : "not_started";
  }

  if (intent === "REVIEW" && saved.status !== "IN_REVIEW" && saved.status !== "APPROVED") {
    const changed = await call<BackendProduct>(`/merchant/products/${saved.id}/status`, {
      method: "PATCH",
      body: { status: "IN_REVIEW" },
    });
    return { id: saved.id, status: changed.status, onModel };
  }
  return { id: saved.id, status: saved.status, onModel };
}
