import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { USING_MOCK } from "./lib/api/mode";
import { detailExists, type DetailKind } from "./lib/api/exists";
import { decodeSession, PROTECTED, SESSION_COOKIE } from "./lib/auth/session";
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
    // A path that matches no route: the global 404 page, with a real 404 status.
    return NextResponse.rewrite(new URL(`/${locale}/_not-found`, request.url), { status: 404 });
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
  }
  return intl(request);
}

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
