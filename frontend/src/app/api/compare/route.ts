import { connection } from "next/server";
import { api } from "@/lib/api";
import { MAX_COMPARE } from "@/lib/saved-list";
import { parseIds } from "@/lib/saved/ids";

/** Variant rows for /compare, in the order the guest added them. */
export async function GET(request: Request) {
  await connection();
  const ids = parseIds(new URL(request.url).searchParams.get("ids"), MAX_COMPARE);
  const items = ids.length ? await api.getCompareItems(ids) : [];
  return Response.json(items, { headers: { "Cache-Control": "private, max-age=60" } });
}
