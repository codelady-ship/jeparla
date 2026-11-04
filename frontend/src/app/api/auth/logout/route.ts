import { clearSession } from "@/lib/auth/server";

export async function POST() {
  await clearSession();
  return new Response(null, { status: 204 });
}
