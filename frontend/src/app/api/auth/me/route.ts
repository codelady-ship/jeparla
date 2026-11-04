import { readSession } from "@/lib/auth/server";

export async function GET() {
  const session = await readSession();
  return Response.json({ session }, { headers: { "Cache-Control": "private, no-store" } });
}
