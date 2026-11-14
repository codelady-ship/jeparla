import { cookies } from "next/headers";
import { API_BASE } from "@/lib/api/http";
import { endSession, REFRESH_COOKIE } from "@/lib/auth/backend";

/** Ends the session here and revokes the refresh token family in the backend. */
export async function POST() {
  const refresh = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (refresh) {
    await fetch(`${API_BASE}/api/v1/auth/logout`, {
      method: "POST",
      headers: { Cookie: `jeparla_refresh=${refresh}` },
      signal: AbortSignal.timeout(5_000),
    }).catch(() => undefined);
  }
  await endSession();
  return new Response(null, { status: 204 });
}
