import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { buildManifest } from "@/lib/pwa/manifest";
import { manifestText } from "@/lib/pwa/manifest-text";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/** The web app manifest in one language (start URL, description, shortcuts). */
export async function GET(_request: Request, ctx: RouteContext<"/[locale]/manifest.webmanifest">) {
  const { locale } = await ctx.params;
  if (!hasLocale(routing.locales, locale)) return new Response(null, { status: 404 });
  return Response.json(buildManifest(locale, await manifestText(locale)), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
