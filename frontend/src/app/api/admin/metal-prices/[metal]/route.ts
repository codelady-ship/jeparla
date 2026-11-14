import { USING_MOCK } from "@/lib/api";
import { adminApi } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/http";
import { problemResponse } from "@/lib/api/problem";
import { decisionSchema, nextStatus } from "@/lib/admin/decisions";
import { decideQuote } from "@/lib/admin/live";
import { conflict, fieldConflict, notFound, readAdmin } from "@/lib/admin/server";
import { overrideSchema, priceJump } from "@/lib/admin/settings";
import { userFetch } from "@/lib/auth/backend";
import { requestLocale } from "@/lib/auth/server";
import { gramPrice } from "@/lib/pricing";

const METALS = new Set(["GOLD", "SILVER", "PLATINUM", "PALLADIUM"]);

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
  const read = await readAdmin(request, decisionSchema, { live: true });
  if (read instanceof Response) return read;
  if (!USING_MOCK) {
    const metal = (await ctx.params).metal;
    return METALS.has(metal) ? decideQuote(request, metal, read.data) : notFound();
  }
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
  const read = await readAdmin(request, overrideSchema, { live: true });
  if (read instanceof Response) return read;
  const { pricePerOunce, reason, confirmLarge } = read.data;
  if (!USING_MOCK) {
    const metal = (await ctx.params).metal;
    if (!METALS.has(metal)) return notFound();
    try {
      return Response.json(
        await userFetch(`/admin/metal-prices/${metal}`, {
          method: "PUT",
          body: { pricePerOunce, reason, confirmLarge },
          canRefresh: true,
          locale: requestLocale(request),
        }),
      );
    } catch (e) {
      if (e instanceof ApiError && e.code === "metal_prices.large_change")
        return fieldConflict("pricePerOunce", "largeChange");
      return problemResponse(e);
    }
  }
  const item = await find(ctx);
  if (!item) return notFound();
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
