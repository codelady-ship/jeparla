import { adminApi } from "@/lib/api/admin";
import { fieldConflict, readAdmin } from "@/lib/admin/server";
import { synonymSchema } from "@/lib/admin/settings";
import { normalizeQuery } from "@/lib/search/normalize";

/**
 * POST /api/v1/admin/search/synonyms: a synonym group for one language.
 * Terms are compared folded (ə = e, ü = u ...), the way search compares them.
 */
export async function POST(request: Request) {
  const read = await readAdmin(request, synonymSchema);
  if (read instanceof Response) return read;
  const input = read.data;
  const all = await adminApi.synonyms();
  const term = normalizeQuery(input.term);
  if (all.some((g) => g.locale === input.locale && normalizeQuery(g.term) === term))
    return fieldConflict("term", "taken");
  const id = Math.max(0, ...all.map((g) => g.id)) + 1;
  return Response.json({ id, ...input }, { status: 201 });
}
