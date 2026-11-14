import { connection } from "next/server";
import { api } from "@/lib/api";
import { IMAGE_MAX_BYTES, isImageMagic } from "@/lib/search/image";

/**
 * Search by photo (#163). GET: whether it is available. POST (multipart `image`):
 * forwards the photo to the API, which embeds it in memory; nothing is stored or
 * logged here either. The size and magic number are checked first, so a wrong
 * file never leaves this server.
 */
export async function GET() {
  await connection();
  return Response.json(await api.imageSearchStatus(), {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}

export async function POST(request: Request) {
  await connection();
  const noStore = { "Cache-Control": "no-store" };
  let image: FormDataEntryValue | null = null;
  try {
    image = (await request.formData()).get("image");
  } catch {
    image = null;
  }
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
  const result = await api.searchByImage(image);
  const status = result.ok
    ? 200
    : result.error === "search.image_not_configured"
      ? 503
      : result.error === "rate_limited"
        ? 429
        : 400;
  return Response.json(result, { status, headers: noStore });
}
