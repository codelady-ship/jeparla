import {
  CircleCheck,
  CircleDashed,
  CircleMinus,
  CircleX,
  MapPin,
  Store as StoreIcon,
} from "lucide-react";
import { formatGrams, formatPrice } from "@/lib/money";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Reveal } from "@/components/motion/reveal";
import { MetalPriceWidget } from "@/components/metal/metal-price-widget";
import { ProductGrid } from "@/components/product/product-grid";
import { JsonLd } from "@/components/seo/json-ld";
import { SITE_URL } from "@/i18n/alternates";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { breadcrumbs, product as productLd } from "@/lib/seo/json-ld";
import { whatsappLink } from "@/lib/whatsapp";
import type { CheckStatus, Product, Store } from "@/types/api";
import { Gallery } from "./gallery";
import { ReportDialog } from "./report-dialog";
import { VariantPanel, type VariantView } from "./variant-panel";

const STATUS_ICON: Record<CheckStatus, typeof CircleCheck> = {
  VERIFIED: CircleCheck,
  PENDING: CircleDashed,
  REJECTED: CircleX,
  NONE: CircleMinus,
};

export async function ProductDetails({
  product: p,
  store,
}: {
  product: Product;
  store: Store | null;
}) {
  const [t, tp, tc, format, locale, categories, similar] = await Promise.all([
    getTranslations("Pdp"),
    getTranslations("Product"),
    getTranslations("Common"),
    getFormatter(),
    getLocale(),
    api.listCategories(),
    api.listProducts({ category: undefined, size: 96 }),
  ]);
  const name = p.name[locale];
  const category = categories.find((c) => c.id === p.categoryId);
  const parent = category?.parentId ? categories.find((c) => c.id === category.parentId) : null;
  const url = `${SITE_URL}/${locale}/products/${p.slug}`;
  const related = similar.content
    .filter((x) => x.id !== p.id && (x.categoryId === p.categoryId || x.metal === p.metal))
    .sort((a, b) => Number(b.categoryId === p.categoryId) - Number(a.categoryId === p.categoryId))
    .slice(0, 4);

  const variants: VariantView[] = p.variants.map((v) => ({
    id: v.id,
    label: [
      v.fineness.label,
      formatGrams(v.weightGrams, locale),
      v.size && t("size", { size: v.size }),
    ]
      .filter(Boolean)
      .join(" · "),
    price: formatPrice(v.price.amount, locale),
    sku: v.sku,
    stock: tp(`stock.${v.stockStatus}`),
    inStock: v.stockStatus !== "OUT_OF_STOCK",
    updatedIso: v.priceUpdatedAt,
    updated: format.dateTime(new Date(v.priceUpdatedAt), "priceUpdated"),
    whatsappHref: store
      ? whatsappLink(store.whatsapp, t("whatsappMessage", { name, sku: v.sku, url }))
      : "#",
  }));
  const first = p.variants[0];

  const facts: [string, string][] = [
    [t("facts.metal"), tp(`metal.${p.metal}`)],
    [t("facts.fineness"), first?.fineness.label ?? String(p.fineness)],
    [t("facts.weight"), formatGrams(p.weightGrams, locale)],
    ...(first?.size ? [[t("facts.size"), first.size] as [string, string]] : []),
    [t("facts.price"), formatPrice(p.priceFrom.amount, locale)],
    [t("facts.pricing"), t(`pricing.${p.pricingMode}`)],
    [t("facts.store"), p.store.name],
    [t("facts.city"), p.store.city],
  ];

  return (
    <article className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
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
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/products" className="hover:text-foreground">
              {t("catalog")}
            </Link>
          </li>
          {[parent, category].filter(Boolean).map((c) => (
            <li key={c!.id} className="before:mr-1 before:content-['/']">
              <Link href={`/categories/${c!.slug}`} className="hover:text-foreground">
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
          images={p.images.map((img) => ({
            url: img.url,
            alt: img.alt[locale],
            aiGenerated: img.aiGenerated,
          }))}
          labels={{
            prev: t("prevImage"),
            next: t("nextImage"),
            zoom: t("zoom"),
            close: tc("close"),
            ai: tp("aiImage"),
            position: t.raw("imagePosition") as string,
          }}
        />

        <div className="flex flex-col gap-6">
          <div>
            <Link
              href={`/stores/${p.store.slug}`}
              className="link-underline text-sm font-medium text-muted-foreground"
            >
              {p.store.name}
            </Link>
            <h1 className="mt-1 text-3xl leading-tight sm:text-4xl">{name}</h1>
          </div>

          <VariantPanel
            productId={p.id}
            variants={variants}
            labels={{
              choose: t("chooseVariant"),
              sku: t("sku"),
              priceUpdated: t("priceUpdated"),
              whatsapp: t("whatsapp"),
              metalLinkedNote: p.pricingMode === "METAL_LINKED" ? t("metalLinkedNote") : null,
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

          <p className="text-sm leading-relaxed">{p.description[locale]}</p>

          <section aria-labelledby="facts">
            <h2 id="facts" className="mb-3 text-xl">
              {t("factsTitle")}
            </h2>
            <table className="w-full text-sm">
              <tbody>
                {facts.map(([k, v]) => (
                  <tr key={k} className="border-b last:border-0">
                    <th
                      scope="row"
                      className="py-2 pr-4 text-left font-normal text-muted-foreground"
                    >
                      {k}
                    </th>
                    <td className="py-2 text-right font-medium tabular-nums">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    {(["type", "shape", "carat", "color", "clarity", "certificate"] as const).map(
                      (h) => (
                        <th key={h} scope="col" className="py-2 pr-3 font-normal">
                          {t(`stones.${h}`)}
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
                          ? [s.certificateLab, s.certificateNumber].filter(Boolean).join(" ")
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
          <p className="mb-3 text-sm text-muted-foreground">{t("verificationText")}</p>
          <ul className="flex flex-col gap-2">
            {(["seller", "documents", "expertise"] as const).map((k) => {
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
                <Link href={`/stores/${store.slug}`} className="link-underline">
                  {store.name}
                </Link>
              </p>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin aria-hidden className="size-4" />
                {store.address}
              </p>
              <p className="text-sm text-muted-foreground">{store.description[locale]}</p>
            </div>
          </Reveal>
        )}

        <MetalPriceWidget className="lg:col-span-2" />
      </div>

      {related.length > 0 && (
        <section aria-labelledby="similar" className="mt-16">
          <h2 id="similar" className="mb-6 text-2xl">
            {t("similar")}
          </h2>
          <ProductGrid products={related} />
        </section>
      )}
    </article>
  );
}
