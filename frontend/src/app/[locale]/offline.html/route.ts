import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { offlinePageHtml } from "@/lib/pwa/offline-page";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/** "No internet" page; the service worker caches it and shows it when a page fails. */
export async function GET(_request: Request, ctx: RouteContext<"/[locale]/offline.html">) {
  const { locale } = await ctx.params;
  if (!hasLocale(routing.locales, locale)) return new Response(null, { status: 404 });
  const t = await getTranslations({ locale, namespace: "Pwa" });
  const html = offlinePageHtml({
    locale,
    title: t("offlineTitle"),
    text: t("offlineText"),
    retry: t("retry"),
  });
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" },
  });
}
