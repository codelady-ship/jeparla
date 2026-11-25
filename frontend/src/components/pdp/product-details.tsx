import {
  Check,
  CircleCheck,
  CircleDashed,
  CircleMinus,
  CircleX,
  Gift,
  MapPin,
  PenLine,
  Ruler,
  Shapes,
  Stamp,
  Store as StoreIcon,
  Truck,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { approxPrices } from "@/lib/currency";
import { formatGrams, formatMm, formatPrice } from "@/lib/money";
import { getFormatter, getLocale, getMessages, getTranslations } from "next-intl/server";
import { RelatedGuides } from "@/components/guides/related-guides";
import { IntlProvider } from "@/components/i18n/intl-provider";
import type { Locale } from "@/i18n/routing";
import { Reveal } from "@/components/motion/reveal";
import { MetalPriceWidget } from "@/components/metal/metal-price-widget";
import { ProductGrid } from "@/components/product/product-grid";
import { JsonLd } from "@/components/seo/json-ld";
import { ShareButton } from "@/components/share/share-button";
import { shareLabels } from "@/components/share/share-labels";
import { SITE_URL } from "@/i18n/alternates";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { breadcrumbs, isRealPrice, product as productLd } from "@/lib/seo/json-ld";
import type { ReactNode } from "react";
import { clipLength } from "@/lib/merchant/video";
import { CONTACT_QUESTIONS, whatsappLink, type ContactQuestion } from "@/lib/whatsapp";
import type { CheckStatus, Dimensions, Product, Store, StoreServiceKind } from "@/types/api";
import { Gallery } from "./gallery";
import { PriceBreakdownBlock } from "./price-breakdown";
import { RecentlyViewed } from "./recently-viewed";
import { ReportDialog } from "./report-dialog";
import { TermHint } from "./term-hint";
import { VariantPanel, type VariantView } from "./variant-panel";

const STATUS_ICON: Record<CheckStatus, typeof CircleCheck> = {
  VERIFIED: CircleCheck,
  PENDING: CircleDashed,
  REJECTED: CircleX,
  NONE: CircleMinus,
};

const DIMENSION_FIELDS = [
  "widthMm",
  "thicknessMm",
  "lengthMm",
  "diameterMm",
] as const satisfies readonly (keyof Dimensions)[];

/** The store's own services (#174); Ruler for resizing. */
const SERVICE_ICONS: Record<StoreServiceKind, LucideIcon> = {
  RESIZE: Ruler,
  ENGRAVING: PenLine,
  GIFT_WRAP: Gift,
  DELIVERY: Truck,
  RETURNS: Undo2,
};

export async function ProductDetails({
  product: p,
  store,
}: {
  product: Product;
  store: Store | null;
}) {
  const [t, tp, tc, format, locale, categories, similar, share, rates, metalPrices] =
    await Promise.all([
      getTranslations("Pdp"),
      getTranslations("Product"),
      getTranslations("Common"),
      getFormatter(),
      getLocale(),
      api.listCategories(),
      api.listProducts({ category: undefined, size: 96 }),
      shareLabels(),
      // USD/EUR is an extra (#53): without rates the page shows AZN only.
      api.latestExchangeRates().catch(() => []),
      // The price breakdown (#104) works without them: a FIXED price then shows the total only.
      api.latestMetalPrices().catch(() => []),
    ]);
  const rateDate = rates[0]?.date;
  const name = p.name[locale];
  const category = categories.find((c) => c.id === p.categoryId);
  const parent = category?.parentId ? categories.find((c) => c.id === category.parentId) : null;
  const url = `${SITE_URL}/${locale}/products/${p.slug}`;
  const related = similar.content
    .filter(
      (x) =>
        x.id !== p.id &&
        (x.categoryId === p.categoryId ||
          (p.metal ? x.metal === p.metal : x.materialKind === p.materialKind)),
    )
    .sort((a, b) => Number(b.categoryId === p.categoryId) - Number(a.categoryId === p.categoryId))
    .slice(0, 4);

  const variants: VariantView[] = p.variants.map((v) => {
    const label = [
      v.fineness?.label,
      v.weightGrams && formatGrams(v.weightGrams, locale),
      v.size && t("size", { size: v.size }),
    ]
      .filter(Boolean)
      .join(" ·");
    // The size question only makes sense for a variant that has a size.
    const questions = CONTACT_QUESTIONS.filter((q) => q !== "SIZE" || Boolean(v.size));
    const message = (q: ContactQuestion) =>
      q === "GENERAL"
        ? t("whatsappMessage", { name, sku: v.sku, url })
        : t(`contact.messages.${q}`, {
            product: t("contact.product", { name, variant: label, sku: v.sku, url }),
          });
    return {
      id: v.id,
      label,
      price: formatPrice(v.price.amount, locale),
      sku: v.sku,
      stock: tp(`stock.${v.stockStatus}`),
      inStock: v.stockStatus !== "OUT_OF_STOCK",
      updatedIso: v.priceUpdatedAt,
      updated: format.dateTime(new Date(v.priceUpdatedAt), "priceUpdated"),
      whatsapp: questions.map((q) => ({
        question: q,
        label: t(`contact.questions.${q}`),
        href: store ? whatsappLink(store.whatsapp, message(q)) : "#",
      })),
      approx: approxPrices(v.price.amount, rates, locale),
    };
  });
  const first = p.variants[0];

  // A term key adds a "what is this" hint next to the label (#174).
  const hint = (key: "fineness" | "carat" | "color" | "clarity", term: string) => (
    <TermHint term={term} label={t(`terms.${key}.label`)} text={t(`terms.${key}.text`)} />
  );
  // The latest price change among the variants (metal-linked ones move every business day).
  const updatedIso = p.variants
    .map((v) => v.priceUpdatedAt)
    .sort()
    .at(-1);
  // Quotable facts in the initial HTML; the price is the same "from" price as the JSON-LD offer.
  // Bijouterie (#128) has a material instead of a metal and a fineness; the weight is optional.
  const fashion = p.materialKind === "FASHION" || p.metal === null;
  // Hallmark and label photos (#106): what the seller showed, not a laboratory assay.
  const evidence = p.evidencePhotos ?? [];
  const hallmark = evidence.find((e) => e.kind === "HALLMARK");
  const facts: [string, ReactNode, ReactNode?][] = [
    ...(fashion
      ? [
          [t("facts.kind"), t("fashionTitle")] as [string, string],
          [t("facts.material"), tp(`material.${p.material ?? "OTHER"}`)] as [string, string],
        ]
      : [
          [t("facts.metal"), p.metal ? tp(`metal.${p.metal}`) : ""] as [string, string],
          [
            t("facts.fineness"),
            first?.fineness?.label ?? String(p.fineness),
            hint("fineness", t("facts.fineness")),
          ] as [string, ReactNode, ReactNode],
        ]),
    ...(p.weightGrams
      ? [[t("facts.weight"), formatGrams(p.weightGrams, locale)] as [string, string]]
      : []),
    ...(first?.size ? [[t("facts.size"), first.size] as [string, string]] : []),
    // Sizes in mm (#174): a row only for what the seller entered.
    ...DIMENSION_FIELDS.flatMap((k) => {
      const v = p.dimensions?.[k];
      return v ? [[t(`facts.${k}`), formatMm(v, locale)] as [string, string]] : [];
    }),
    ...(isRealPrice(p.priceFrom)
      ? [[t("facts.price"), formatPrice(p.priceFrom.amount, locale)] as [string, string]]
      : []),
    [t("facts.pricing"), t(`pricing.${p.pricingMode}`)],
    ...(updatedIso
      ? [
          [
            t("facts.updated"),
            <time key="updated" dateTime={updatedIso}>
              {format.dateTime(new Date(updatedIso), "priceUpdated")}
            </time>,
          ] as [string, ReactNode],
        ]
      : []),
    // Precious jewelry only: bijouterie has no hallmark (#128).
    ...(fashion
      ? []
      : [
          [t("facts.hallmarkPhoto"), hallmark ? t("evidence.yes") : t("evidence.no")] as [
            string,
            string,
          ],
        ]),
    [t("facts.store"), p.store.name],
    [t("facts.city"), p.store.city],
  ];

  return (
    <article className="container-page py-6 sm:py-10">
      <JsonLd
        data={[
          productLd(p, locale),
          breadcrumbs([
            { name: t("catalog"), path: `/${locale}/products` },
            ...[parent, category]
              .filter((c) => c != null)
              .map((c) => ({
                name: c.name[locale],
                path: `/${locale}/categories/${c.slug}`,
              })),
            { name, path: `/${locale}/products/${p.slug}` },
          ]),
        ]}
      />
      <nav aria-label={t("breadcrumb")} className="mb-6 text-sm text-muted-foreground">
        {/* Breadcrumb and store links: no viewport prefetch. Each prefetch also loads the
            target route's client chunks, which took this page past the script budget (#269). */}
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/products" prefetch={false} className="hover:text-foreground">
              {t("catalog")}
            </Link>
          </li>
          {[parent, category].filter(Boolean).map((c) => (
            <li key={c!.id} className="before:mr-1 before:content-['/']">
              <Link
                href={`/categories/${c!.slug}`}
                prefetch={false}
                className="hover:text-foreground"
              >
                {c!.name[locale]}
              </Link>
            </li>
          ))}
          <li
            aria-current="page"
            className="truncate text-foreground before:mr-1 before:content-['/']"
          >
            {name}
          </li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <Gallery
          productId={p.id}
          images={[
            ...p.images.map((img) => ({
              url: img.url,
              alt: img.alt[locale],
              aiGenerated: img.aiGenerated,
            })),
            // Hallmark and label shots after the product photos, each with its own badge (#106).
            ...evidence.map((e) => ({
              url: e.url,
              alt: t(`evidence.alt.${e.kind}`, { name }),
              aiGenerated: false,
              badge: t(`evidence.badge.${e.kind}`),
            })),
          ]}
          video={
            p.video && {
              url: p.video.url,
              contentType: p.video.contentType,
              aiGenerated: p.video.aiGenerated,
              length: clipLength(p.video.durationMs),
            }
          }
          labels={{
            prev: t("prevImage"),
            next: t("nextImage"),
            zoom: t("zoom"),
            close: tc("close"),
            ai: tp("aiImage"),
            position: t.raw("imagePosition") as string,
            onModel: { show: t("onModel.show"), back: t("onModel.back") },
            video: p.video && {
              badge: t("video.badge"),
              ai: t("video.ai"),
              play: t("video.play", { name }),
              label: t("video.label", { name }),
              position: t.raw("video.position") as string,
              loading: t("video.loading"),
            },
          }}
        />

        {/* Desktop: price, WhatsApp and facts stay in view while the photos scroll (#173). */}
        <div className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Link
                href={`/stores/${p.store.slug}`}
                prefetch={false}
                className="link-underline text-sm font-medium text-muted-foreground"
              >
                {p.store.name}
              </Link>
              <h1 className="mt-1 text-3xl leading-tight sm:text-4xl">{name}</h1>
            </div>
            <ShareButton labels={share} url={url} title={name} className="shrink-0" />
          </div>

          <VariantPanel
            productId={p.id}
            storeSlug={p.store.slug}
            priceFrom={p.priceFrom}
            openingHours={store?.openingHours ?? null}
            variants={variants}
            labels={{
              choose: t("chooseVariant"),
              sku: t("sku"),
              priceUpdated: t("priceUpdated"),
              whatsapp: t("whatsapp"),
              questionLegend: t("contact.legend"),
              status: {
                open: t("contact.open"),
                closedToday: t.raw("contact.closedToday") as string,
                closedTomorrow: t.raw("contact.closedTomorrow") as string,
                closedOn: t.raw("contact.closedOn") as string,
                closedHint: t("contact.closedHint"),
              },
              metalLinkedNote: p.pricingMode === "METAL_LINKED" ? t("metalLinkedNote") : null,
              currency: rateDate
                ? {
                    label: t("currency"),
                    note: t("approxNote", {
                      date: format.dateTime(new Date(`${rateDate}T00:00:00Z`), {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        timeZone: "UTC",
                      }),
                    }),
                  }
                : null,
              actions: {
                favoriteAdd: tp("favoriteAdd"),
                favoriteRemove: tp("favoriteRemove"),
                compareAdd: tp("compareAdd"),
                compareRemove: tp("compareRemove"),
                compareFull: tp("compareFull"),
                compareOpen: tp("compareOpen"),
              },
            }}
          />

          <PriceBreakdownBlock
            product={p}
            variants={variants.map((v) => ({ id: v.id, label: v.label }))}
            metalPrices={metalPrices}
          />

          <p className="text-sm leading-relaxed">{p.description[locale]}</p>

          {(p.keyFeatures ?? []).length > 0 && (
            <section aria-labelledby="features">
              <h2 id="features" className="mb-2 text-base font-semibold">
                {t("keyFeatures")}
              </h2>
              <ul className="flex flex-col gap-1.5 text-sm">
                {(p.keyFeatures ?? []).map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-text" />
                    {f}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {fashion && (
            <aside
              aria-labelledby="fashion"
              className="flex items-start gap-3 rounded-md border bg-muted/50 p-3 text-sm"
            >
              <Shapes aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div>
                <p id="fashion" className="font-medium">
                  {t("fashionTitle")}
                </p>
                <p className="text-muted-foreground">{t("fashionNote")}</p>
                <RelatedGuides locale={locale} slugs={["bijouterie-vs-precious"]} />
              </div>
            </aside>
          )}

          <section aria-labelledby="facts">
            <h2 id="facts" className="mb-3 text-xl">
              {t("factsTitle")}
            </h2>
            <table data-keep-clear="" className="w-full text-sm">
              <tbody>
                {facts.map(([k, v, h]) => (
                  <tr key={k} className="border-b last:border-0">
                    <th
                      scope="row"
                      className="py-2 pr-4 text-left font-normal text-muted-foreground"
                    >
                      {k}
                      {h}
                    </th>
                    <td className="py-2 text-right font-medium tabular-nums">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {evidence.length > 0 && (
              // A named region: aria-label on a plain div has no role to name (axe aria-prohibited-attr).
              <section
                aria-label={t("evidence.title")}
                className="mt-3 flex items-start gap-3 rounded-md border p-3 text-sm"
              >
                <Stamp aria-hidden className="mt-0.5 size-5 shrink-0 text-gold-text" />
                <div className="flex flex-col gap-1">
                  <p>{t("evidence.added")}</p>
                  {evidence.some((e) => e.checked) && (
                    <p className="text-muted-foreground">{t("evidence.checked")}</p>
                  )}
                  <p className="text-muted-foreground">{t("evidence.notAssay")}</p>
                </div>
              </section>
            )}
          </section>

          <ReportDialog
            labels={{
              open: t("report.open"),
              title: t("report.title"),
              text: t("report.text"),
              reasonsLegend: t("report.reason"),
              reasons: (["WRONG_INFO", "FAKE", "PRICE", "OTHER"] as const).map((r) => ({
                value: r,
                label: t(`report.reasons.${r}`),
              })),
              details: t("report.details"),
              submit: t("report.submit"),
              unavailable: t("report.unavailable"),
              close: tc("close"),
            }}
          />
        </div>
      </div>

      <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-2 lg:gap-12">
        {p.stones.length > 0 && (
          <Reveal as="section" aria-labelledby="stones">
            <h2 id="stones" className="mb-3 text-xl">
              {t("stonesTitle")}
            </h2>
            {/* Scrolls sideways on phones: focusable so keyboard users can scroll it too. */}
            <div
              className="overflow-x-auto rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              tabIndex={0}
              role="region"
              aria-labelledby="stones"
            >
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    {(["type", "shape", "carat", "color", "clarity", "certificate"] as const).map(
                      (h) => (
                        <th key={h} scope="col" className="py-2 pr-3 font-normal">
                          {t(`stones.${h}`)}
                          {(h === "carat" || h === "color" || h === "clarity") &&
                            hint(h, t(`stones.${h}`))}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {p.stones.map((s, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        {t(`stoneType.${s.type}`)}
                        {s.origin === "LAB_GROWN" && ` (${t("labGrown")})`}
                        {s.count > 1 && ` ×${s.count}`}
                      </td>
                      <td className="py-2 pr-3">{s.shape ?? t("na")}</td>
                      <td className="py-2 pr-3 tabular-nums">{s.carat ?? t("na")}</td>
                      <td className="py-2 pr-3">{s.color ?? t("na")}</td>
                      <td className="py-2 pr-3">{s.clarity ?? t("na")}</td>
                      <td className="py-2 pr-3">
                        {s.certificateLab
                          ? [s.certificateLab, s.certificateNumber].filter(Boolean).join("")
                          : t("noCertificate")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        )}

        <Reveal as="section" aria-labelledby="verification">
          <h2 id="verification" className="mb-1 text-xl">
            {t("verificationTitle")}
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            {t("verificationText")}{" "}
            <Link
              href="/verified"
              prefetch={false}
              className="link-underline font-medium text-foreground"
            >
              {t("howWeVerify")}
            </Link>
          </p>
          <ul className="flex flex-col gap-2">
            {/* Bijouterie has only the seller check: no documents or expertise badges (#128). */}
            {(fashion
              ? (["seller"] as const)
              : (["seller", "documents", "expertise"] as const)
            ).map((k) => {
              const status = p.verification[k];
              const Icon = STATUS_ICON[status];
              return (
                <li key={k} className="flex items-start gap-3 rounded-md border p-3">
                  <Icon
                    aria-hidden
                    className={
                      status === "VERIFIED"
                        ? "mt-0.5 size-5 text-success"
                        : status === "REJECTED"
                          ? "mt-0.5 size-5 text-destructive"
                          : "mt-0.5 size-5 text-muted-foreground"
                    }
                  />
                  <div>
                    <p className="text-sm font-medium">{t(`checks.${k}`)}</p>
                    <p className="text-sm text-muted-foreground">{t(`checkStatus.${status}`)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Reveal>

        {store && (
          <Reveal as="section" aria-labelledby="store">
            <h2 id="store" className="mb-3 text-xl">
              {t("storeTitle")}
            </h2>
            <div className="flex flex-col gap-2 rounded-lg border p-4">
              <p className="flex items-center gap-2 font-medium">
                <StoreIcon aria-hidden className="size-4 text-gold-text" />
                <Link
                  href={`/stores/${store.slug}`}
                  prefetch={false}
                  className="touch-target relative link-underline"
                >
                  {store.name}
                </Link>
              </p>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin aria-hidden className="size-4" />
                {store.address}
              </p>
              <p className="text-sm text-muted-foreground">{store.description[locale]}</p>
              {((store.services ?? []).length > 0 || store.returnPolicy) && (
                <div className="mt-2 flex flex-col gap-2 border-t pt-3">
                  <h3 className="text-sm font-semibold">{t("services.title")}</h3>
                  {(store.services ?? []).length > 0 && (
                    <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
                      {(store.services ?? []).map((s) => {
                        const Icon = SERVICE_ICONS[s];
                        return (
                          <li key={s} className="flex items-center gap-2">
                            <Icon aria-hidden className="size-4 shrink-0 text-gold-text" />
                            {t(`services.${s}`)}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {store.returnPolicy && (
                    <p className="text-sm">
                      <span className="font-medium">{t("services.returnPolicy")}: </span>
                      {store.returnPolicy}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{t("services.note")}</p>
                </div>
              )}
            </div>
          </Reveal>
        )}

        {/* Bijouterie prices do not follow metal rates, so no metal price block (#128). */}
        {!fashion && <MetalPriceWidget className="lg:col-span-2" />}
      </div>

      {related.length > 0 && (
        <section aria-labelledby="similar" className="mt-16">
          <h2 id="similar" className="mb-6 text-2xl">
            {t("similar")}
          </h2>
          <ProductGrid products={related} belowFold />
        </section>
      )}

      {/* Its cards render in the browser: they need the Product messages, which the layout
          does not send to every page. */}
      <IntlProvider locale={locale} messages={await recentlyViewedMessages(locale)}>
        <RecentlyViewed productId={p.id} title={t("recentlyViewed")} />
      </IntlProvider>
    </article>
  );
}

/** Messages for the client-rendered "recently viewed" cards (a provider replaces, not merges). */
async function recentlyViewedMessages(locale: Locale) {
  const m = await getMessages({ locale });
  return { Common: m.Common, Errors: m.Errors, Product: m.Product };
}
