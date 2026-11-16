import { USING_MOCK } from "@/lib/api";
import { merchantApi } from "@/lib/api/merchant";
import { problemResponse } from "@/lib/api/problem";
import { fieldErrors } from "@/lib/auth/schemas";
import { readJson, requestLocale } from "@/lib/auth/server";
import { saveProduct } from "@/lib/merchant/save";
import { productSubmit } from "@/lib/merchant/schemas";
import { merchantOr401 } from "@/lib/merchant/server";

/** PUT /api/v1/merchant/products/{id}: same as create; the backend checks ownership. */
export async function PUT(request: Request, ctx: RouteContext<"/api/merchant/products/[id]">) {
  const session = await merchantOr401();
  if (session instanceof Response) return session;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0)
    return Response.json({ error: "not_found" }, { status: 404 });
  const parsed = productSubmit.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ errors: fieldErrors(parsed.error) }, { status: 400 });
  const { intent, product } = parsed.data;
  if (!USING_MOCK) {
    try {
      return Response.json(await saveProduct(intent, product, id, requestLocale(request)));
    } catch (e) {
      return problemResponse(e);
    }
  }
  const api = merchantApi(session);
  const existing = await api.product(id);
  if (!existing) return Response.json({ error: "not_found" }, { status: 404 });
  if (intent === "REVIEW") {
    if ((await api.store()).sellerStatus !== "VERIFIED")
      return Response.json({ errors: { form: "sellerNotApproved" } }, { status: 403 });
    if (
      product.docs.length === 0 &&
      product.materialKind !== "FASHION" &&
      existing.status === "DRAFT"
    )
      return Response.json({ errors: { form: "docsRequired" } }, { status: 400 });
  }
  // Any change to a live product goes back to review (PLAN 5.9).
  const status = intent === "REVIEW" ? "IN_REVIEW" : "DRAFT";
  return Response.json({ id, status });
}
