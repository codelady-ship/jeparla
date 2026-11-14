import { USING_MOCK } from "@/lib/api/mode";
import { problemResponse } from "@/lib/api/problem";
import { userFetch } from "@/lib/auth/backend";

const LANGS = new Set(["az", "en", "ru"]);

/** The empty CSV template with headers in the chosen language, as a download (#109). */
export async function GET(request: Request) {
  if (USING_MOCK) return Response.json({ errors: { form: "unavailable" } }, { status: 503 });
  const asked = new URL(request.url).searchParams.get("lang") ?? "az";
  const lang = LANGS.has(asked) ? asked : "az";
  try {
    const csv = await userFetch<string>("/merchant/products/import/template", {
      query: { lang },
      asText: true,
      canRefresh: true,
    });
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="jeparla-products-${lang}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return problemResponse(e);
  }
}
