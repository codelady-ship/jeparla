import { api as publicApi, USING_MOCK } from "@/lib/api";
import { merchantApi } from "@/lib/api/merchant";
import { problemResponse } from "@/lib/api/problem";
import { userFetch } from "@/lib/auth/backend";
import { requestLocale } from "@/lib/auth/server";
import { toProductInput, type BackendProduct } from "@/lib/merchant/backend";
import { QUICK_MAX_IDS, quickFromInput, type QuickRow } from "@/lib/merchant/quick-edit";
import { merchantOr401 } from "@/lib/merchant/server";

/** Backend calls at the same time; enough for 100 drafts in a few seconds. */
const PARALLEL = 6;

/**
 * GET /api/merchant/products/quick?ids=1,2,3 (#109): category, metal, fineness, weight and
 * price mode of the seller's drafts for the quick-edit table. Each product is read with the
 * seller's token, so the backend checks ownership; one that cannot be read is left out.
 */
export async function GET(request: Request) {
  const session = await merchantOr401();
  if (session instanceof Response) return session;
  const raw = new URL(request.url).searchParams.get("ids") ?? "";
  const ids = [...new Set(raw.split(",").map(Number))].filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0 || ids.length > QUICK_MAX_IDS)
    return Response.json({ errors: { form: "server" } }, { status: 400 });

  try {
    const categories = USING_MOCK ? [] : await publicApi.listCategories();
    const own = merchantApi(session);
    const read = async (id: number): Promise<QuickRow | null> => {
      if (USING_MOCK) {
        const p = await own.product(id);
        return p && p.status === "DRAFT" ? quickFromInput(id, p.input) : null;
      }
      const p = await userFetch<BackendProduct>(`/merchant/products/${id}`, {
        canRefresh: true,
        locale: requestLocale(request),
      }).catch(() => null);
      return p && p.status === "DRAFT" ? quickFromInput(id, toProductInput(p, categories)) : null;
    };
    const rows: QuickRow[] = [];
    for (let i = 0; i < ids.length; i += PARALLEL) {
      const batch = await Promise.all(ids.slice(i, i + PARALLEL).map(read));
      for (const r of batch) if (r) rows.push(r);
    }
    return Response.json(rows);
  } catch (e) {
    return problemResponse(e);
  }
}
