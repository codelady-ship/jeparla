import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { decodeSession, PROTECTED, SESSION_COOKIE } from "./lib/auth/session";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);
const LOCALE_PREFIX = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);

/**
 * Locale routing, plus a UX-only gate for /merchant and /admin: guests go to the
 * login page, wrong roles go home. Real access control is in the backend.
 */
export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const locale = pathname.match(LOCALE_PREFIX)?.[1];
  const rest = locale ? pathname.slice(locale.length + 1) || "/" : pathname;
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
