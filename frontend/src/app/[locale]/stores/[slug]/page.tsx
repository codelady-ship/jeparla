import { Clock, FileCheck2, MapPin, MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { isVerified } from "@/components/product/product-card";
import { ProductGridSkeleton } from "@/components/product/product-grid";
import { StoreMonogram } from "@/components/stores/store-card";
import { JsonLd } from "@/components/seo/json-ld";
import { ShareButton } from "@/components/share/share-button";
import { shareLabels } from "@/components/share/share-labels";
import { StoreProducts } from "@/components/stores/store-products";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { alternates } from "@/i18n/alternates";
import { Link } from "@/i18n/navigation";
import { openGraph } from "@/lib/seo/open-graph";
import { routing } from "@/i18n/routing";
import { api, USING_MOCK } from "@/lib/api";
import { slugParams } from "@/lib/api/static-params";
import { formatOpeningHours } from "@/lib/opening-hours";
import { breadcrumbs, jewelryStore } from "@/lib/seo/json-ld";
import { whatsappLink } from "@/lib/whatsapp";
import { cn } from "cn";

export async function generateStaticParams() {
  const stores = await api.listStores();
  return slugParams(stores.map((s) => s.slug));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/stores/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const locale = await rootLocale();
  const store = await api.getStore(slug);
  // Resolved before the streamed body: an unknown store answers a real 404, not a soft 200.
  if (!store) notFound();
  if (!hasLocale(routing.locales, locale)) return {};
  return {
    title: `${store.name}, ${store.city}`,
    description: store.description[locale],
    alternates: alternates(locale, `/stores/${store.slug}`),
    openGraph: openGraph(
      locale,
      `/stores/${store.slug}`,
      store.logoUrl ? { images: [{ url: store.logoUrl, alt: store.name }] } : {},
    ),
    // Demo data is invented and must not be indexed as real stores or products.
    ...(USING_MOCK && { robots: { index: false, follow: true } }),
  };
}

export default async function StorePage({
  params,
  searchParams,
}: PageProps<"/[locale]/stores/[slug]">) {
  const { slug } = await params;
  const store = await api.getStore(slug);
  if (!store) notFound();
  const [t, tp, tv, locale, share] = await Promise.all([
    getTranslations("Stores"),
    getTranslations("Product"),
    getTranslations("Verified"),
    getLocale(),
    shareLabels(),
  ]);
  const mapHref = store.geo
    ? `https://www.google.com/maps/search/?api=1&query=${store.geo.lat},${store.geo.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address)}`;
  const checks = (["seller", "documents"] as const).filter(
    (k) => store.verification[k] === "VERIFIED",
  );

  return (
    <div className="container-page py-8 sm:py-12">
      <JsonLd
        data={[
          jewelryStore(store, locale),
          breadcrumbs([
            { name: t("title"), path: `/${locale}/stores` },
            { name: store.name, path: `/${locale}/stores/${store.slug}` },
          ]),
        ]}
      />
      <header className="flex flex-col gap-6 border-b pb-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-5">
          <StoreMonogram name={store.name} size="lg" />
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl sm:text-4xl">{store.name}</h1>
            <p className="flex items-center gap-1 text-muted-foreground">
              <MapPin aria-hidden className="size-4" />
              {store.city}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {isVerified(store.verification) && <Badge variant="gold">{tp("verified")}</Badge>}
              {checks.length > 0 && !isVerified(store.verification) && (
                <span className="text-muted-foreground">{t("sellerVerified")}</span>
              )}
              {checks.length > 0 && (
                <Link
                  href="/verified"
                  prefetch={false}
                  className="link-underline text-muted-foreground"
                >
                  {tv("title")}
                </Link>
              )}
              <span className="text-muted-foreground">
                {t("productCount", { count: store.productCount })}
              </span>
            </div>
            {store.codeAcceptedOn && (
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <FileCheck2 aria-hidden className="size-4" />
                <Link href="/verified#code" prefetch={false} className="link-underline">
                  {t("codeAccepted", {
                    date: new Intl.DateTimeFormat(locale, {
                      dateStyle: "long",
                      timeZone: "UTC",
                    }).format(new Date(`${store.codeAcceptedOn}T00:00:00Z`)),
                  })}
                </Link>
              </p>
            )}
            <p className="max-w-xl text-sm leading-relaxed">{store.description[locale]}</p>
            <ShareButton labels={share} title={store.name} className="mt-2 self-start" />
          </div>
        </div>

        <section
          aria-labelledby="visit"
          className="flex w-full flex-col gap-3 rounded-lg border p-4 lg:max-w-sm"
        >
          <h2 id="visit" className="text-xl">
            {t("visit")}
          </h2>
          <p className="flex items-start gap-2 text-sm">
            <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-text" />
            <span>
              {store.address}
              <br />
              <a
                href={mapHref}
                target="_blank"
                rel="noopener noreferrer"
                className="link-underline font-medium"
              >
                {t("openMap")}
              </a>
            </span>
          </p>
          <div className="flex items-start gap-2 text-sm">
            <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-text" />
            <ul>
              {formatOpeningHours(store.openingHours, locale).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <p className="flex items-center gap-2 text-sm">
            <Phone aria-hidden className="size-4 shrink-0 text-gold-text" />
            <a
              href={`tel:${store.phone}`}
              className="touch-target relative link-underline tabular-nums"
            >
              {store.phone}
            </a>
          </p>
          <a
            href={whatsappLink(store.whatsapp, t("whatsappMessage", { store: store.name }))}
            target="_blank"
            rel="noopener noreferrer"
            data-keep-clear=""
            className={cn(buttonVariants({ variant: "gold" }), "mt-1 h-10 pointer-coarse:h-11")}
          >
            <MessageCircle aria-hidden />
            {t("whatsapp")}
          </a>
        </section>
      </header>

      <section aria-labelledby="store-products" className="mt-10">
        <h2 id="store-products" className="mb-6 text-2xl">
          {t("products")}
        </h2>
        <Suspense fallback={<ProductGridSkeleton label={tp("loading")} />}>
          <StoreProducts slug={store.slug} searchParams={searchParams} />
        </Suspense>
      </section>
    </div>
  );
}
