import { cookies } from "next/headers";
import { apiFetch, ApiError, API_BASE, type RequestOptions } from "@/lib/api/http";
import { visitorHeaders } from "@/lib/api/live";
import {
  ACCESS_COOKIE,
  BACKEND_REFRESH_COOKIE,
  needsRefresh,
  REFRESH_COOKIE,
  refreshTokenFrom,
} from "./tokens";
import { SESSION_MAX_AGE, type Role, type Session } from "./session";
import { clearSession, writeSession } from "./server";

export { ACCESS_COOKIE, REFRESH_COOKIE };

/**
 * Backend sign-in for the Next.js server (backend-for-frontend). The browser never sees a
 * token: the access JWT and the refresh token live in httpOnly cookies of this site, and the
 * route handlers and server components call the API with them. Roles and ownership are still
 * checked by the backend on every call; the session cookie only drives the UI.
 */
/** Body of a successful register, login or refresh (backend AuthResponse). */
export type AuthResponse = {
  accessToken: string;
  expiresIn: number;
  user: {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    role: Role;
    locale: string;
    /** False until the address is confirmed, and always false without an e-mail (#131). */
    emailVerified?: boolean;
  };
};

export const sessionOf = (user: AuthResponse["user"]): Session => ({
  name: user.name,
  email: user.email ?? user.phone ?? "",
  role: user.role,
  // A phone-only account has nothing to confirm: no reminder for it.
  ...(user.email &&
    typeof user.emailVerified === "boolean" && {
      emailVerified: user.emailVerified,
    }),
});

const cookieBase = () => ({
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  httpOnly: true,
});

/** Stores both tokens and the UI session. Route handlers only (cookies are written). */
export async function startSession(auth: AuthResponse, refreshToken: string | null) {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, auth.accessToken, { ...cookieBase(), maxAge: auth.expiresIn });
  if (refreshToken)
    jar.set(REFRESH_COOKIE, refreshToken, { ...cookieBase(), maxAge: SESSION_MAX_AGE });
  await writeSession(sessionOf(auth.user));
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  await clearSession();
}

/**
 * Calls an auth endpoint that answers AuthResponse plus the refresh cookie
 * (register, login, refresh) with the visitor named for the rate limits.
 */
export async function authCall(
  path: string,
  body: unknown,
  extra: { cookie?: string; locale?: string } = {},
): Promise<{ auth: AuthResponse; refreshToken: string | null }> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1/auth${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(extra.locale && { "Accept-Language": extra.locale }),
        ...(extra.cookie && { Cookie: extra.cookie }),
        ...(await visitorHeaders()),
      },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new ApiError(0, `POST /auth${path}`);
  }
  if (!res.ok) {
    const p = (await res.json().catch(() => ({}))) as {
      code?: string;
      detail?: string;
      errors?: { field: string; message: string }[];
    };
    throw new ApiError(res.status, `POST /auth${path}`, p.code ?? null, p.detail ?? null, p.errors);
  }
  return { auth: (await res.json()) as AuthResponse, refreshToken: refreshTokenFrom(res.headers) };
}

/** Exchanges the stored refresh token for new tokens. Route handlers only. */
export async function refreshSession(): Promise<string | null> {
  const jar = await cookies();
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  if (!refresh) return null;
  try {
    const { auth, refreshToken } = await authCall("/refresh", null, {
      cookie: `${BACKEND_REFRESH_COOKIE}=${refresh}`,
    });
    await startSession(auth, refreshToken);
    return auth.accessToken;
  } catch (e) {
    // A rejected token ends the session; a backend outage keeps it for the next try.
    if (e instanceof ApiError && e.status === 401) await endSession();
    return null;
  }
}

/** The access token as stored (server components: the proxy refreshed it before the render). */
export async function accessToken(): Promise<string | null> {
  return (await cookies()).get(ACCESS_COOKIE)?.value ?? null;
}

/**
 * API call as the signed-in user. In route handlers (`canRefresh`) an expired token is
 * refreshed once and the call repeated; server components never refresh, because only one
 * place may rotate the refresh token (a second use of it revokes the whole session).
 */
export async function userFetch<T>(
  path: string,
  options: Omit<RequestOptions, "token"> & { canRefresh?: boolean } = {},
): Promise<T> {
  const { canRefresh = false, ...rest } = options;
  let token = await accessToken();
  if (canRefresh && needsRefresh(token)) token = (await refreshSession()) ?? token;
  if (!token) throw new ApiError(401, path, "auth.unauthenticated");
  try {
    return await apiFetch<T>(path, { ...rest, token });
  } catch (e) {
    if (!(canRefresh && e instanceof ApiError && e.status === 401)) throw e;
    const fresh = await refreshSession();
    if (!fresh) throw e;
    return apiFetch<T>(path, { ...rest, token: fresh });
  }
}
