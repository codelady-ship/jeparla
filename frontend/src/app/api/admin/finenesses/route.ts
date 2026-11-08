import { adminApi } from "@/lib/api/admin";
import { fieldConflict, readAdmin } from "@/lib/admin/server";
import { finenessSchema } from "@/lib/admin/settings";

/** POST /api/v1/admin/finenesses: a new fineness (əyar) for one metal. Demo: nothing is stored. */
export async function POST(request: Request) {
  const read = await readAdmin(request, finenessSchema);
  if (read instanceof Response) return read;
  const input = read.data;
  const all = await adminApi.finenesses();
  if (all.some((f) => f.metal === input.metal && f.value === input.value))
    return fieldConflict("value", "taken");
  const id = Math.max(0, ...all.map((f) => f.id)) + 1;
  return Response.json({ id, ...input, productCount: 0 }, { status: 201 });
}
