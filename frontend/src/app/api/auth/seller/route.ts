import { AUTH_AVAILABLE, readJson, unavailable, writeSession } from "@/lib/auth/server";
import { normalizePhone, sellerSignup } from "@/lib/seller/schemas";

/**
 * Seller sign-up from the /sell wizard. Demo mode only: nothing is stored, the
 * store waits for admin checks (PLAN 5.9) and the account becomes MERCHANT so
 * the dashboard opens. Day 5 replaces this with the backend endpoint.
 */
export async function POST(request: Request) {
  if (!AUTH_AVAILABLE) return unavailable();
  const parsed = sellerSignup.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ errors: { form: "server" } }, { status: 400 });
  const { account } = parsed.data;
  const session = {
    name: account.name,
    // No e-mail in this flow; the phone identifies the seller.
    email: normalizePhone(account.phone) ?? account.phone,
    role: "MERCHANT" as const,
  };
  await writeSession(session);
  return Response.json({ session }, { status: 201 });
}
