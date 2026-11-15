import { ImageResponse } from "next/og";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { api } from "@/lib/api";
import { BRAND_OG, imageAsDataUrl } from "@/lib/seo/og-image";

/**
 * 1200x630 link preview of a store (#100): name, city, verified mark, product count and the
 * newest product photo, for WhatsApp, Instagram and Telegram. Everything comes from
 * GET /stores/{slug}/preview; nothing is drawn that the store does not have.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/og/store/[slug]">) {
  const { slug } = await ctx.params;
  const url = new URL(request.url);
  const asked = url.searchParams.get("locale");
  const locale = hasLocale(routing.locales, asked) ? asked : routing.defaultLocale;
  const preview = await api.getStorePreview(slug).catch(() => null);
  if (!preview) return new Response("Not found", { status: 404 });
  const t = await getTranslations({ locale, namespace: "Stores.og" });
  const cover = preview.coverImageUrl
    ? await imageAsDataUrl(new URL(preview.coverImageUrl, url.origin).toString())
    : null;
  const C = BRAND_OG;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: C.cream,
        color: C.text,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: cover ? 660 : 1200,
          padding: 64,
          background: C.green,
          color: C.cream,
        }}
      >
        <div style={{ display: "flex", fontSize: 30, color: C.gold, letterSpacing: 4 }}>
          JEPARLA
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 68, lineHeight: 1.1 }}>{preview.name}</div>
          <div style={{ display: "flex", fontSize: 32, opacity: 0.85 }}>
            {[preview.city, t("products", { count: preview.productCount })]
              .filter(Boolean)
              .join(" · ")}
          </div>
          {preview.verified && (
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                padding: "10px 22px",
                borderRadius: 999,
                border: `2px solid ${C.gold}`,
                color: C.gold,
                fontSize: 26,
              }}
            >
              {t("verified")}
            </div>
          )}
        </div>
        <div style={{ display: "flex", fontSize: 26, opacity: 0.8 }}>{t("cta")}</div>
      </div>
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element -- ImageResponse draws plain img only
        <img src={cover} alt="" width={540} height={630} style={{ objectFit: "cover" }} />
      )}
    </div>,
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public, max-age=600, s-maxage=3600" },
    },
  );
}
