import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { ProductDetails } from "@/components/pdp/product-details";
import { alternates } from "@/i18n/alternates";
import { openGraph } from "@/lib/seo/open-graph";
import { routing } from "@/i18n/routing";
import { api, USING_MOCK } from "@/lib/api";
import { slugParams } from "@/lib/api/static-params";

// Known products are prerendered; new ones render on first request.
export async function generateStaticParams() {
  const page = await api.listProducts({ size: 96 });
  return slugParams(page.content.map((p) => p.slug));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const locale = await rootLocale();
  const p = await api.getProduct(slug);
  // The page streams (cacheComponents), so a notFound() in the page body can come after a 200
  // was sent. Metadata is resolved before the response for crawlers: they get a real 404.
  if (!p) notFound();
  if (!hasLocale(routing.locales, locale)) return {};
  const name = p.name[locale];
  return {
    title: name,
    description: p.description[locale],
    alternates: alternates(locale, `/products/${p.slug}`),
    // Demo data is invented and must not be indexed as real stores or products.
    ...(USING_MOCK && { robots: { index: false, follow: true } }),
    openGraph: openGraph(locale, `/products/${p.slug}`, {
      title: name,
      ...(p.images[0] && { images: [{ url: p.images[0].url, alt: p.images[0].alt[locale] }] }),
    }),
  };
}

export default async function ProductPage({ params }: PageProps<"/[locale]/products/[slug]">) {
  const { slug } = await params;
  const product = await api.getProduct(slug);
  if (!product) notFound();
  const store = await api.getStore(product.store.slug);
  return <ProductDetails product={product} store={store} />;
}
