import { redirect } from "next/navigation";
import { adminApi, type AdminApi } from "@/lib/api/admin";
import { AUTH_AVAILABLE, readJson, readSession, unavailable } from "@/lib/auth/server";
import type { Session } from "@/lib/auth/session";
import type { z } from "zod";
import { decisionSchema, type Decision } from "./decisions";
import { fieldErrors } from "./settings";

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
 * Shared start of every admin write route: availability, role and the body,
 * parsed with the given schema. Returns the session and the data, or the error response.
 */
export async function readAdmin<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ session: Session; data: z.infer<T> } | Response> {
  if (!AUTH_AVAILABLE) return unavailable();
  const session = await readSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return Response.json({ error: "forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ errors: fieldErrors(parsed.error) }, { status: 400 });
  return { session, data: parsed.data };
}

/** A positive integer id from the route, or null. */
export function readId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Admin decision routes: readAdmin with the decision schema and a numeric target id. */
export async function readDecision(
  request: Request,
  rawId: string,
): Promise<{ id: number; decision: Decision } | Response> {
  const id = readId(rawId);
  const read = await readAdmin(request, decisionSchema);
  if (read instanceof Response) return read;
  if (id === null) return notFound();
  return { id, decision: read.data };
}

export const notFound = () => Response.json({ error: "not_found" }, { status: 404 });
export const conflict = () => Response.json({ errors: { form: "conflict" } }, { status: 409 });

/** 409 with a field error, e.g. { slug: "taken" }. */
export const fieldConflict = (field: string, code: string) =>
  Response.json({ errors: { [field]: code } }, { status: 409 });
