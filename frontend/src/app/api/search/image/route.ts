import { connection } from "next/server";
import { api } from "@/lib/api";
import { FILTER_FIELDS, IMAGE_MAX_BYTES, isImageMagic } from "@/lib/search/image";
import type { ImageSearchPanelStatus } from "@/types/api";

/**
 * Search by photo (#163). GET: whether it is available, with the result filter
 * options (top-level categories, finenesses) when it is. POST (multipart `image`
 * and optional filter fields): forwards the photo to the API, which embeds it in
 * memory; nothing is stored or logged here either. The size and magic number are
 * checked first, so a wrong file never leaves this server.
 */
export async function GET() {
  await connection();
  const status = await api.imageSearchStatus();
  let body: ImageSearchPanelStatus = status;
  if (status.configured) {
    const [categories, finenesses] = await Promise.all([
      api.listCategories().catch(() => []),
      api.listFinenesses().catch(() => []),
    ]);
    body = {
      ...status,
      categories: categories
        .filter((c) => c.parentId === null)
        .map((c) => ({ slug: c.slug, name: c.name })),
      finenesses: [...new Set(finenesses.map((f) => f.value))].sort((a, b) => a - b),
    };
  }
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=60" } });
}

/** Filter fields of the form, short and without control characters; anything else is dropped. */
function filterFields(form: FormData | null): [string, string][] {
  if (!form) return [];
  const out: [string, string][] = [];
  for (const key of FILTER_FIELDS) {
    const value = form.get(key);
    if (
      typeof value === "string" &&
      value.trim() &&
      value.length <= 160 &&
      !/[\u0000-\u001f]/.test(value)
    ) {
      out.push([key, value.trim()]);
    }
  }
  return out;
}

export async function POST(request: Request) {
  await connection();
  const noStore = { "Cache-Control": "no-store" };
  let form: FormData | null = null;
  try {
    form = await request.formData();
  } catch {
    form = null;
  }
  const image = form?.get("image") ?? null;
  if (!(image instanceof Blob) || image.size === 0 || image.size > IMAGE_MAX_BYTES) {
    return Response.json(
      { ok: false, error: "search.image_size" },
      { status: 400, headers: noStore },
    );
  }
  const head = new Uint8Array(await image.slice(0, 16).arrayBuffer());
  if (!isImageMagic(head)) {
    return Response.json(
      { ok: false, error: "search.image_type" },
      { status: 400, headers: noStore },
    );
  }
  const result = await api.searchByImage(image, filterFields(form));
  const status = result.ok
    ? 200
    : result.error === "search.image_not_configured"
      ? 503
      : result.error === "rate_limited"
        ? 429
        : 400;
  return Response.json(result, { status, headers: noStore });
}
