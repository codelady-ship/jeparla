import { redirect } from "next/navigation";
import { merchantApi, type MerchantApi } from "@/lib/api/merchant";
import { readSession } from "@/lib/auth/server";
import type { Session } from "@/lib/auth/session";

const MERCHANT_ROLES = new Set(["MERCHANT", "ADMIN"]);

/**
 * Cabinet pages: the proxy already sent guests to /login, this is the second
 * check (the backend is the real one). Returns the session and its API.
 */
export async function merchantContext(): Promise<{ session: Session; api: MerchantApi }> {
  const session = await readSession();
  if (!session) redirect("/login?next=/merchant");
  if (!MERCHANT_ROLES.has(session.role)) redirect("/");
  return { session, api: merchantApi(session) };
}

/** Route handlers: the session, or the error response to return. */
export async function merchantOr401(): Promise<Session | Response> {
  const session = await readSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!MERCHANT_ROLES.has(session.role))
    return Response.json({ error: "forbidden" }, { status: 403 });
  return session;
}
