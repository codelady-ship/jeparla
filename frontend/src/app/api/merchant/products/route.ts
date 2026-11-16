import { USING_MOCK } from "@/lib/api";
import { merchantApi } from "@/lib/api/merchant";
import { problemResponse } from "@/lib/api/problem";
import { fieldErrors } from "@/lib/auth/schemas";
import { readJson, requestLocale } from "@/lib/auth/server";
import { saveProduct } from "@/lib/merchant/save";
import { productSubmit } from "@/lib/merchant/schemas";
import { merchantOr401 } from "@/lib/merchant/server";

/**
 * POST /api/v1/merchant/products for the product form (create, photos, optional review).
 * With the sample data it only validates and answers like the backend; nothing is stored.
 */
export async function POST(request: Request) {
  const session = await merchantOr401();
  if (session instanceof Response) return session;
  const parsed = productSubmit.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ errors: fieldErrors(parsed.error) }, { status: 400 });
  const { intent, product } = parsed.data;
  if (!USING_MOCK) {
    try {
      const saved = await saveProduct(intent, product, null, requestLocale(request));
      return Response.json(saved, { status: 201 });
    } catch (e) {
      return problemResponse(e);
    }
  }
  if (intent === "REVIEW") {
    const store = await merchantApi(session).store();
    if (store.sellerStatus !== "VERIFIED")
      return Response.json({ errors: { form: "sellerNotApproved" } }, { status: 403 });
    // Bijouterie needs no documents (#128).
    if (product.docs.length === 0 && product.materialKind !== "FASHION")
      return Response.json({ errors: { form: "docsRequired" } }, { status: 400 });
  }
  const status = intent === "REVIEW" ? "IN_REVIEW" : "DRAFT";
  return Response.json({ id: 9100, status }, { status: 201 });
}
