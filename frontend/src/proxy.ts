import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { USING_MOCK } from "./lib/api/mode";
import { detailExists, type DetailKind } from "./lib/api/exists";
import { API_BASE } from "./lib/api/http";
import {
  decodeSession,
  PROTECTED,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  SIGNED_IN_COOKIE,
} from "./lib/auth/session";
import {
  ACCESS_COOKIE,
  BACKEND_REFRESH_COOKIE,
  needsRefresh,
  REFRESH_COOKIE,
  refreshTokenFrom,
  relayHeaders,
} from "./lib/auth/tokens";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);
const LOCALE_PREFIX = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);
const DETAIL = /^\/(products|stores|categories)\/([^/]+)\/?$/;

function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Locale routing, plus a UX-only gate for /merchant and /admin: guests go to the
 * login page, wrong roles go home. Real access control is in the backend.
 */
export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const locale = pathname.match(LOCALE_PREFIX)?.[1];
  const rest = locale ? pathname.slice(locale.length + 1) || "/" : pathname;

  // Detail pages stream, so their own notFound() could only send a 200 with noindex.
  // Only full document loads: client navigations and prefetches (RSC requests) have no
  // status to fix and would ask the backend for every card on a page.
  const isDocument = !request.headers.has("rsc") && !request.headers.has("next-router-prefetch");
  const detail = locale && isDocument ? rest.match(DETAIL) : null;
  if (detail && !(await detailExists(detail[1] as DetailKind, decodeSlug(detail[2]), USING_MOCK))) {
    // The site 404 page in this language (app/[locale]/404), with a real 404 status.
    return NextResponse.rewrite(new URL(`/${locale}/404`, request.url), { status: 404 });
  }
  const area = PROTECTED.find((p) => rest === p.prefix || rest.startsWith(`${p.prefix}/`));

  if (area) {
    const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value);
    const base = `/${locale ?? routing.defaultLocale}`;
    if (!session) {
      const url = new URL(`${base}/login`, request.url);
      url.searchParams.set("next", rest + search);
      return NextResponse.redirect(url);
    }
    if (!area.roles.includes(session.role)) {
      return NextResponse.redirect(new URL(base, request.url));
    }
    // Cabinet pages call the API with the access token while they render, and a server
    // component cannot store a new one: refresh it here, then load the page again.
    if (!USING_MOCK && needsRefresh(request.cookies.get(ACCESS_COOKIE)?.value)) {
      const refreshed = await refreshTokens(request);
      if (refreshed === "expired") {
        const url = new URL(`${base}/login`, request.url);
        url.searchParams.set("next", rest + search);
        return clearAuth(NextResponse.redirect(url));
      }
      if (refreshed) {
        const again = NextResponse.redirect(request.url, 303);
        writeTokens(again, refreshed);
        return again;
      }
    }
  }
  return intl(request);
}

type Tokens = { access: string; expiresIn: number; refresh: string | null };

/** New tokens, "expired" when the backend refused the refresh token, null when unreachable. */
async function refreshTokens(request: NextRequest): Promise<Tokens | "expired" | null> {
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refresh) return "expired";
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Cookie: `${BACKEND_REFRESH_COOKIE}=${refresh}`,
        ...relayHeaders((name) => request.headers.get(name)),
      },
      signal: AbortSignal.timeout(5_000),
    });
    if (res.status === 401) return "expired";
    if (!res.ok) return null;
    const body = (await res.json()) as { accessToken: string; expiresIn: number };
    return {
      access: body.accessToken,
      expiresIn: body.expiresIn,
      refresh: refreshTokenFrom(res.headers),
    };
  } catch {
    return null;
  }
}

const tokenCookie = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: process.env.NODE_ENV === "production",
} as const;

function writeTokens(response: NextResponse, tokens: Tokens) {
  response.cookies.set(ACCESS_COOKIE, tokens.access, { ...tokenCookie, maxAge: tokens.expiresIn });
  if (tokens.refresh)
    response.cookies.set(REFRESH_COOKIE, tokens.refresh, {
      ...tokenCookie,
      maxAge: SESSION_MAX_AGE,
    });
}

function clearAuth(response: NextResponse) {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, SESSION_COOKIE, SIGNED_IN_COOKIE])
    response.cookies.delete(name);
  return response;
}

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
