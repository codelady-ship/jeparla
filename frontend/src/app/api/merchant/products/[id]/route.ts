import { merchantApi } from "@/lib/api/merchant";
import { AUTH_AVAILABLE, readJson, unavailable } from "@/lib/auth/server";
import { fieldErrors } from "@/lib/auth/schemas";
import { productSubmit } from "@/lib/merchant/schemas";
import { merchantOr401 } from "@/lib/merchant/server";

/** PUT /api/v1/merchant/products/{id} (demo): same checks as create, plus ownership. */
export async function PUT(request: Request, ctx: RouteContext<"/api/merchant/products/[id]">) {
  if (!AUTH_AVAILABLE) return unavailable();
  const session = await merchantOr401();
  if (session instanceof Response) return session;
  const api = merchantApi(session);
  const id = Number((await ctx.params).id);
  const existing = Number.isInteger(id) ? await api.product(id) : null;
  if (!existing) return Response.json({ error: "not_found" }, { status: 404 });
  const parsed = productSubmit.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ errors: fieldErrors(parsed.error) }, { status: 400 });
  const { intent, product } = parsed.data;
  if (intent === "REVIEW") {
    if ((await api.store()).sellerStatus !== "VERIFIED")
      return Response.json({ errors: { form: "sellerNotApproved" } }, { status: 403 });
    if (product.docs.length === 0 && existing.status === "DRAFT")
      return Response.json({ errors: { form: "docsRequired" } }, { status: 400 });
  }
  // Any change to a live product goes back to review (PLAN 5.9).
  const status = intent === "REVIEW" ? "IN_REVIEW" : "DRAFT";
  return Response.json({ id, status });
}
