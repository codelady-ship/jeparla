import { z } from "zod";
import { USING_MOCK } from "@/lib/api/mode";
import { IMPORT_MAX_BYTES, XLSX_TYPE } from "@/lib/merchant/bulk";
import { problemResponse } from "@/lib/api/problem";
import { userFetch } from "@/lib/auth/backend";
import { readJson, requestLocale } from "@/lib/auth/server";

const body = z.object({
  /** CSV text, or ... */
  csv: z.string().min(1).max(IMPORT_MAX_BYTES).optional(),
  /** ... an Excel .xlsx file as base64 (4/3 of the byte limit). */
  xlsx: z
    .string()
    .min(1)
    .max(Math.ceil((IMPORT_MAX_BYTES * 4) / 3) + 4)
    .regex(/^[A-Za-z0-9+/]+=*$/)
    .optional(),
  notPreciousConfirmed: z.boolean().default(false),
  idempotencyKey: z.uuid(),
});

/**
 * Spreadsheet product import (#109): the browser sends the CSV text or the .xlsx file
 * (base64), this handler passes it to the backend as text/csv or as the Excel type. Each
 * valid row becomes a DRAFT; row errors come back localized. The Idempotency-Key is made
 * once per chosen file, so sending it again creates nothing twice.
 */
export async function POST(request: Request) {
  if (USING_MOCK) return Response.json({ errors: { form: "unavailable" } }, { status: 503 });
  const parsed = body.safeParse(await readJson(request));
  if (!parsed.success || (parsed.data.csv === undefined) === (parsed.data.xlsx === undefined))
    return Response.json({ errors: { form: "importFile" } }, { status: 400 });
  const { csv, xlsx, notPreciousConfirmed, idempotencyKey } = parsed.data;
  const raw = xlsx === undefined ? undefined : Uint8Array.from(Buffer.from(xlsx, "base64"));
  if (raw && raw.byteLength > IMPORT_MAX_BYTES)
    return Response.json({ errors: { form: "csvSize" } }, { status: 400 });
  try {
    const result = await userFetch("/merchant/products/import", {
      method: "POST",
      rawBody: raw ? raw.buffer : csv,
      headers: {
        "Content-Type": raw ? XLSX_TYPE : "text/csv; charset=utf-8",
        "Idempotency-Key": idempotencyKey,
      },
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
