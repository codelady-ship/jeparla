import { api } from "@/lib/api";
import { apiFetch } from "@/lib/api/http";
import { problemResponse } from "@/lib/api/problem";
import { authCall, sessionOf, startSession } from "@/lib/auth/backend";
import { DEMO_AUTH, readJson, requestLocale, writeSession } from "@/lib/auth/server";
import { normalizePhone, sellerSignup } from "@/lib/seller/schemas";

/**
 * Seller sign-up from the /sell wizard:
 * 1. POST /auth/register/merchant (the phone is the login),
 * 2. POST /merchant/stores: the application, PENDING until an admin approves it,
 * 3. the optional first product as a DRAFT (POST /merchant/products).
 * Documents are uploaded afterwards in the cabinet (private storage, #40): the wizard
 * only lists what the seller will need. With the sample data nothing is stored.
 */
export async function POST(request: Request) {
  const parsed = sellerSignup.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ errors: { form: "server" } }, { status: 400 });
  const { account, store, product } = parsed.data;
  const phone = normalizePhone(account.phone) ?? account.phone;
  if (DEMO_AUTH) {
    // No e-mail in this flow; the phone identifies the seller.
    const session = { name: account.name, email: phone, role: "MERCHANT" as const };
    await writeSession(session);
    return Response.json({ session }, { status: 201 });
  }

  const locale = requestLocale(request);
  let session;
  let token: string;
  try {
    const { auth, refreshToken } = await authCall(
      "/register/merchant",
      { name: account.name, phone, password: account.password },
      { locale },
    );
    await startSession(auth, refreshToken);
    session = sessionOf(auth.user);
    token = auth.accessToken;
  } catch (e) {
    return problemResponse(e);
  }

  try {
    await apiFetch("/merchant/stores", {
      method: "POST",
      token,
      locale,
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: {
        name: store.storeName,
        whatsapp: normalizePhone(store.whatsapp) ?? store.whatsapp,
        city: store.city,
        address: store.address,
        social: store.social,
        legalType: store.legalType,
        taxId: store.taxId,
        // The wizard question (#128): precious, bijouterie or both.
        sellerKind: store.sellerKind,
        // Required by the schema above, so always true here (#107).
        codeAccepted: store.codeAccepted,
      },
    });
    // The wizard's first product is a precious one; a bijouterie store adds it in the cabinet.
    if (product && store.sellerKind !== "FASHION") {
      const [categories, finenesses] = await Promise.all([
        api.listCategories(),
        api.listFinenesses(),
      ]);
      const category = categories.find((c) => c.slug === product.category);
      const fineness = finenesses.find((f) => String(f.id) === product.fineness);
      if (category && fineness) {
        await apiFetch("/merchant/products", {
          method: "POST",
          token,
          locale,
          headers: { "Idempotency-Key": crypto.randomUUID() },
          body: {
            materialKind: "PRECIOUS",
            categoryId: category.id,
            name: { az: product.productName },
            metal: fineness.metal,
            variants: [
              {
                finenessId: fineness.id,
                weightGrams: product.weight,
                price: product.price,
                pricingMode: "FIXED",
                stockStatus: "IN_STOCK",
              },
            ],
          },
        });
      }
    }
  } catch (e) {
    // The account exists and the seller is signed in: the cabinet finishes the store.
    console.error("Seller wizard: store or first product not saved", e);
    return Response.json({ session, partial: true }, { status: 201 });
  }
  return Response.json({ session }, { status: 201 });
}
