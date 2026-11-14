import { redirect } from "next/navigation";
import { adminApi, type AdminApi } from "@/lib/api/admin";
import { USING_MOCK } from "@/lib/api";
import { readJson, readSession, unavailable } from "@/lib/auth/server";
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
 * `live`: the route also works on the real API (stores, products, documents, metal prices).
 */
export async function readAdmin<T extends z.ZodType>(
  request: Request,
  schema: T,
  { live = false }: { live?: boolean } = {},
): Promise<{ session: Session; data: z.infer<T> } | Response> {
  // Sections without an admin API yet stay read-only demos: nothing is pretended saved.
  if (!USING_MOCK && !live) return unavailable();
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
  options: { live?: boolean } = {},
): Promise<{ id: number; decision: Decision } | Response> {
  const id = readId(rawId);
  const read = await readAdmin(request, decisionSchema, options);
  if (read instanceof Response) return read;
  if (id === null) return notFound();
  return { id, decision: read.data };
}

export const notFound = () => Response.json({ error: "not_found" }, { status: 404 });
export const conflict = () => Response.json({ errors: { form: "conflict" } }, { status: 409 });

/** 409 with a field error, e.g. { slug: "taken" }. */
export const fieldConflict = (field: string, code: string) =>
  Response.json({ errors: { [field]: code } }, { status: 409 });
