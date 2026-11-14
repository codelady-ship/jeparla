import { z } from "zod";
import { USING_MOCK } from "@/lib/api/mode";
import { IMPORT_MAX_BYTES } from "@/lib/merchant/bulk";
import { problemResponse } from "@/lib/api/problem";
import { userFetch } from "@/lib/auth/backend";
import { readJson, requestLocale } from "@/lib/auth/server";

const body = z.object({
  csv: z.string().min(1).max(IMPORT_MAX_BYTES),
  notPreciousConfirmed: z.boolean().default(false),
  idempotencyKey: z.uuid(),
});

/**
 * CSV product import (#109): the browser sends the file text, this handler passes it to
 * the backend as text/csv. Each valid row becomes a DRAFT; row errors come back localized.
 * The Idempotency-Key is made once per chosen file, so sending it again creates nothing twice.
 */
export async function POST(request: Request) {
  if (USING_MOCK) return Response.json({ errors: { form: "unavailable" } }, { status: 503 });
  const parsed = body.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ errors: { form: "importFile" } }, { status: 400 });
  const { csv, notPreciousConfirmed, idempotencyKey } = parsed.data;
  try {
    const result = await userFetch("/merchant/products/import", {
      method: "POST",
      rawBody: csv,
      headers: { "Content-Type": "text/csv; charset=utf-8", "Idempotency-Key": idempotencyKey },
      query: { notPreciousConfirmed },
      locale: requestLocale(request),
      timeoutMs: 60_000,
      canRefresh: true,
    });
    return Response.json(result);
  } catch (e) {
    return problemResponse(e);
  }
}
