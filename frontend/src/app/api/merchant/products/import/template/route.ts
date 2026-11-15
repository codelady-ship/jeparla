import { USING_MOCK } from "@/lib/api/mode";
import { problemResponse } from "@/lib/api/problem";
import { userFetch } from "@/lib/auth/backend";
import { XLSX_TYPE } from "@/lib/merchant/bulk";

const LANGS = new Set(["az", "en", "ru"]);

/**
 * The empty import template with headers in the chosen language, as a download (#109):
 * CSV by default, an Excel workbook with `?format=xlsx`.
 */
export async function GET(request: Request) {
  if (USING_MOCK) return Response.json({ errors: { form: "unavailable" } }, { status: 503 });
  const params = new URL(request.url).searchParams;
  const asked = params.get("lang") ?? "az";
  const lang = LANGS.has(asked) ? asked : "az";
  const xlsx = params.get("format") === "xlsx";
  try {
    const body = xlsx
      ? await userFetch<ArrayBuffer>("/merchant/products/import/template.xlsx", {
          query: { lang },
          asBytes: true,
          canRefresh: true,
        })
      : await userFetch<string>("/merchant/products/import/template", {
          query: { lang },
          asText: true,
          canRefresh: true,
        });
    return new Response(body, {
      headers: {
        "Content-Type": xlsx ? XLSX_TYPE : "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="jeparla-products-${lang}.${xlsx ? "xlsx" : "csv"}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return problemResponse(e);
  }
}
