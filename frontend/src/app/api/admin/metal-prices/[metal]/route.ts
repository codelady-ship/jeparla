import { adminApi } from "@/lib/api/admin";
import { decisionSchema, nextStatus } from "@/lib/admin/decisions";
import { conflict, fieldConflict, notFound, readAdmin } from "@/lib/admin/server";
import { overrideSchema, priceJump } from "@/lib/admin/settings";
import { gramPrice } from "@/lib/pricing";

async function find(ctx: RouteContext<"/api/admin/metal-prices/[metal]">) {
  const metal = (await ctx.params).metal;
  return (await adminApi.metalPrices()).find((m) => m.metal === metal) ?? null;
}

/**
 * PATCH /api/v1/admin/metal-prices/{metal}/held: apply or discard a CBAR quote
 * the sanity check held back (daily change above 10%, PLAN 5.10).
 */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/admin/metal-prices/[metal]">,
) {
  const read = await readAdmin(request, decisionSchema);
  if (read instanceof Response) return read;
  const item = await find(ctx);
  if (!item) return notFound();
  if (!item.held) return conflict();
  const status = nextStatus("quote", item.held.status, read.data.action);
  if (!status) return conflict();
  return Response.json({ metal: item.metal, status, note: read.data.reason || null });
}

/**
 * PUT /api/v1/admin/metal-prices/{metal}: manual override of the price in use,
 * with a reason for the audit log. A change above the sanity limit needs an
 * explicit second confirmation; without it the answer is 409 largeChange.
 */
export async function PUT(request: Request, ctx: RouteContext<"/api/admin/metal-prices/[metal]">) {
  const read = await readAdmin(request, overrideSchema);
  if (read instanceof Response) return read;
  const item = await find(ctx);
  if (!item) return notFound();
  const { pricePerOunce, reason, confirmLarge } = read.data;
  const jump = priceJump(item.pricePerOunce, pricePerOunce);
  if (jump.large && !confirmLarge) return fieldConflict("pricePerOunce", "largeChange");
  return Response.json({
    metal: item.metal,
    pricePerOunce,
    pricePerGram: gramPrice(pricePerOunce),
    change: jump.change,
    source: "ADMIN",
    note: reason,
  });
}
