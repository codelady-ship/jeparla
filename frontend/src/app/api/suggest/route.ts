import { connection } from "next/server";
import { api } from "@/lib/api";

/**
 * Grouped autocomplete for the header search (#18). Runs on the server, so the
 * browser never downloads the catalog; the real backend endpoint replaces the mock
 * behind `api` (PLAN 6.2).
 */
export async function GET(request: Request) {
  await connection();
  const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
  const result = await api.suggest(q);
  return Response.json(result, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
