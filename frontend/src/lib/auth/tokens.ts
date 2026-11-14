/**
 * Token helpers without Next.js server imports, shared by the proxy and the route handlers.
 * The browser never reads these cookies (httpOnly); see lib/auth/backend.ts.
 */
export const ACCESS_COOKIE = "jeparla_access";
export const REFRESH_COOKIE = "jeparla_rt";
/** Name of the backend's own refresh cookie (AuthController.REFRESH_COOKIE). */
export const BACKEND_REFRESH_COOKIE = "jeparla_refresh";
/** Refresh this long before the access token expires. */
const EARLY_MS = 60_000;

/** The refresh token the backend set in its own Set-Cookie. */
export function refreshTokenFrom(headers: Headers): string | null {
  for (const line of headers.getSetCookie()) {
    const [pair] = line.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0 && pair.slice(0, eq).trim() === BACKEND_REFRESH_COOKIE) {
      return pair.slice(eq + 1).trim() || null;
    }
  }
  return null;
}

/** Expiry of a JWT in ms (its `exp`), read without verifying: only used to refresh early. */
export function jwtExpiry(token: string | undefined | null): number | null {
  const part = token?.split(".")[1];
  if (!part) return null;
  try {
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

export const needsRefresh = (token: string | undefined | null, now = Date.now()) => {
  const exp = jwtExpiry(token);
  return exp === null || exp - EARLY_MS <= now;
};

/** Headers that name the visitor to the API rate limits (backend ClientIpFilter). */
export function relayHeaders(get: (name: string) => string | null): Record<string, string> {
  const token = process.env.JEPARLA_FRONTEND_TOKEN;
  if (!token) return {};
  const ip =
    get("cf-connecting-ip") ?? get("x-real-ip") ?? get("x-forwarded-for")?.split(",")[0]?.trim();
  return ip ? { "X-Jeparla-Frontend-Token": token, "X-Jeparla-Client-Ip": ip } : {};
}
