import { connection } from "next/server";
import { api } from "@/lib/api";
import { parseIds } from "@/lib/saved/ids";

/** Product cards for the ids a guest saved in localStorage (/favorites). */
export async function GET(request: Request) {
  await connection();
  const ids = parseIds(new URL(request.url).searchParams.get("ids"), 100);
  const products = ids.length ? await api.getProductsByIds(ids) : [];
  return Response.json(products, { headers: { "Cache-Control": "private, max-age=60" } });
}
