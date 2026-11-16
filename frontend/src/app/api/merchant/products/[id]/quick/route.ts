import { api as publicApi, USING_MOCK } from "@/lib/api";
import { merchantApi } from "@/lib/api/merchant";
import { problemResponse } from "@/lib/api/problem";
import { fieldErrors } from "@/lib/auth/schemas";
import { userFetch } from "@/lib/auth/backend";
import { readJson, requestLocale } from "@/lib/auth/server";
import { toProductInput, toProductRequest, type BackendProduct } from "@/lib/merchant/backend";
import { applyQuick, quickSchema } from "@/lib/merchant/quick-edit";
import { merchantOr401 } from "@/lib/merchant/server";
import { compareDecimal } from "@/lib/pricing";

/** Lowest variant price, as the products table shows it. */
const lowest = (p: BackendProduct) =>
  p.variants
    .map((v) => v.price.amount)
    .reduce<string | null>(
      (min, a) => (min === null || compareDecimal(a, min) < 0 ? a : min),
      null,
    );

/**
 * PATCH /api/merchant/products/{id}/quick (#109): one row of the quick-edit table. Reads the
 * stored draft, changes only category, metal, fineness, weight and price mode, and saves it
 * with PUT /api/v1/merchant/products/{id}, so the backend applies the same checks (and the
 * same ownership check) as the product form. Only drafts: a live product would go back to
 * review, which belongs in the full form.
 */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/merchant/products/[id]/quick">,
) {
  const session = await merchantOr401();
  if (session instanceof Response) return session;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0)
    return Response.json({ error: "not_found" }, { status: 404 });
  const parsed = quickSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ errors: fieldErrors(parsed.error) }, { status: 400 });

  if (USING_MOCK) {
    const existing = await merchantApi(session).product(id);
    if (!existing) return Response.json({ error: "not_found" }, { status: 404 });
    if (existing.status !== "DRAFT")
      return Response.json({ errors: { form: "quickNotDraft" } }, { status: 409 });
    return Response.json({ id, status: existing.status, categoryId: null, priceFrom: null });
  }
  const locale = requestLocale(request);
  try {
    const categories = await publicApi.listCategories();
    const existing = await userFetch<BackendProduct>(`/merchant/products/${id}`, {
      canRefresh: true,
      locale,
    });
    if (existing.status !== "DRAFT")
      return Response.json({ errors: { form: "quickNotDraft" } }, { status: 409 });
    const input = applyQuick(toProductInput(existing, categories), parsed.data);
    const body = toProductRequest(input, categories, existing);
    const saved = await userFetch<BackendProduct>(`/merchant/products/${id}`, {
      method: "PUT",
      body,
      canRefresh: true,
      locale,
    });
    return Response.json({
      id: saved.id,
      status: saved.status,
      categoryId: saved.categoryId,
      priceFrom: lowest(saved),
    });
  } catch (e) {
    return problemResponse(e);
  }
}
