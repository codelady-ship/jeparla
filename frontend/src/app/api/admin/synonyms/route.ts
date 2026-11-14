import { USING_MOCK } from "@/lib/api";
import { adminApi } from "@/lib/api/admin";
import { adminCall } from "@/lib/admin/live";
import { fieldConflict, readAdmin } from "@/lib/admin/server";
import { synonymSchema } from "@/lib/admin/settings";
import { normalizeQuery } from "@/lib/search/normalize";

/**
 * POST /api/v1/admin/synonyms: one pair of words search treats as the same query.
 * Words are compared folded (ə = e, ü = u ...), the way search compares them.
 */
export async function POST(request: Request) {
  const read = await readAdmin(request, synonymSchema, { live: true });
  if (read instanceof Response) return read;
  const input = read.data;
  if (!USING_MOCK) return adminCall(request, "/admin/synonyms", { body: input, status: 201 });
  const all = await adminApi.synonyms();
  const key = (a: string, b: string) => [normalizeQuery(a), normalizeQuery(b)].sort().join("|");
  const wanted = key(input.term, input.synonym);
  if (all.some((p) => key(p.term, p.synonym) === wanted)) return fieldConflict("synonym", "taken");
  const id = Math.max(0, ...all.map((p) => p.id)) + 1;
  return Response.json({ id, ...input }, { status: 201 });
}
