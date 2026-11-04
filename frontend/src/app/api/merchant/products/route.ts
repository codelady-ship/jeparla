import { merchantApi } from "@/lib/api/merchant";
import { AUTH_AVAILABLE, readJson, unavailable } from "@/lib/auth/server";
import { fieldErrors } from "@/lib/auth/schemas";
import { productSubmit } from "@/lib/merchant/schemas";
import { merchantOr401 } from "@/lib/merchant/server";

/**
 * POST /api/v1/merchant/products (demo). Validates, checks that only an approved
 * seller sends to review and that review has documents, then answers like the
 * backend would. Nothing is stored in demo mode.
 */
export async function POST(request: Request) {
  if (!AUTH_AVAILABLE) return unavailable();
  const session = await merchantOr401();
  if (session instanceof Response) return session;
  const parsed = productSubmit.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ errors: fieldErrors(parsed.error) }, { status: 400 });
  const { intent, product } = parsed.data;
  if (intent === "REVIEW") {
    const store = await merchantApi(session).store();
    if (store.sellerStatus !== "VERIFIED")
      return Response.json({ errors: { form: "sellerNotApproved" } }, { status: 403 });
    if (product.docs.length === 0)
      return Response.json({ errors: { form: "docsRequired" } }, { status: 400 });
  }
  const status = intent === "REVIEW" ? "IN_REVIEW" : "DRAFT";
  return Response.json({ id: 9100, status }, { status: 201 });
}
