import { connection } from "next/server";
import { indexNowKeyResponse } from "@/lib/seo/indexnow";

/**
 * IndexNow key file (#62), reached as `/<key>.txt` through a rewrite in next.config.ts. The
 * key is read at request time from JEPARLA_INDEXNOW_KEY, so a build never bakes it in.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/indexnow-key/[key]">) {
  await connection();
  const { key } = await ctx.params;
  return indexNowKeyResponse(key);
}
