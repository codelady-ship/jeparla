import { forwardJson } from "@/lib/api/forward";
import { notFound } from "@/lib/admin/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST: a short-lived signed link to one private verification document. The backend
 * checks the ADMIN role and writes every view to the audit log.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return notFound();
  return forwardJson(request, `/admin/documents/${id}/view`, { body: {} });
}
