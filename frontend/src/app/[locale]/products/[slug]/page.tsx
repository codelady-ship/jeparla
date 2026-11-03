import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { ProductDetails } from "@/components/pdp/product-details";
import { alternates } from "@/i18n/alternates";
import { routing } from "@/i18n/routing";
import { api } from "@/lib/api";

// Known products are prerendered; new ones render on first request.
export async function generateStaticParams() {
  const page = await api.listProducts({ size: 96 });
  return page.content.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const locale = await rootLocale();
  const p = await api.getProduct(slug);
  if (!p || !hasLocale(routing.locales, locale)) return {};
  const name = p.name[locale];
  return {
    title: name,
    description: p.description[locale],
    alternates: alternates(locale, `/products/${p.slug}`),
    openGraph: {
      title: name,
      images: p.images[0] ? [{ url: p.images[0].url, alt: p.images[0].alt[locale] }] : [],
    },
  };
}

export default async function ProductPage({ params }: PageProps<"/[locale]/products/[slug]">) {
  const { slug } = await params;
  const product = await api.getProduct(slug);
  if (!product) notFound();
  const store = await api.getStore(product.store.slug);
  return <ProductDetails product={product} store={store} />;
}
