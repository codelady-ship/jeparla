import { redirect } from "next/navigation";
import { adminApi, type AdminApi } from "@/lib/api/admin";
import { AUTH_AVAILABLE, readJson, readSession, unavailable } from "@/lib/auth/server";
import type { Session } from "@/lib/auth/session";
import { decisionSchema, type Decision } from "./decisions";

/**
 * Admin pages: the proxy already sent everyone else away, this is the second
 * check (the backend is the real one).
 */
export async function adminContext(): Promise<{ session: Session; api: AdminApi }> {
  const session = await readSession();
  if (!session) redirect("/login?next=/admin");
  if (session.role !== "ADMIN") redirect("/");
  return { session, api: adminApi };
}

/**
 * Shared start of every admin decision route: availability, role, target id and
 * the decision body. Returns the parsed parts or the error response to send.
 */
export async function readDecision(
  request: Request,
  rawId: string,
): Promise<{ id: number; decision: Decision } | Response> {
  if (!AUTH_AVAILABLE) return unavailable();
  const session = await readSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return Response.json({ error: "forbidden" }, { status: 403 });
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0)
    return Response.json({ error: "not_found" }, { status: 404 });
  const parsed = decisionSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    const errors = Object.fromEntries(
      parsed.error.issues.map((i) => [String(i.path[0] ?? "form"), i.message]),
    );
    return Response.json({ errors }, { status: 400 });
  }
  return { id, decision: parsed.data };
}

export const notFound = () => Response.json({ error: "not_found" }, { status: 404 });
export const conflict = () => Response.json({ errors: { form: "conflict" } }, { status: 409 });
