import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Catalog } from "@/components/catalog/catalog";
import { CollectionBudgets } from "@/components/collections/collection-budgets";
import { CollectionLinks } from "@/components/collections/collection-links";
import { FaqList } from "@/components/faq-list";
import { Reveal } from "@/components/motion/reveal";
import { ProductGridEmpty, ProductGridSkeleton } from "@/components/product/product-grid";
import { JsonLd } from "@/components/seo/json-ld";
import { ShareButton } from "@/components/share/share-button";
import { shareLabels } from "@/components/share/share-labels";
import { alternates } from "@/i18n/alternates";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { api } from "@/lib/api";
import { slugParams } from "@/lib/api/static-params";
import { breadcrumbs, faqPage } from "@/lib/seo/json-ld";
import { openGraph } from "@/lib/seo/open-graph";

const FAQ_KEYS = ["how", "budget", "contact"] as const;

export async function generateStaticParams() {
  // A build against an API without collections yet still succeeds; slugs then render on demand.
  const collections = await api.listCollections().catch(() => []);
  return slugParams(collections.map((c) => c.slug));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/collections/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const locale = await rootLocale();
  const collection = (await api.listCollections()).find((c) => c.slug === slug);
  // Resolved before the streamed body: an unknown or hidden collection answers a real 404.
  if (!collection) notFound();
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Collections" });
  const name = collection.name[locale];
  return {
    title: `${name} — ${t("title")}`,
    description: t("collectionDescription", { name }),
    alternates: alternates(locale, `/collections/${collection.slug}`),
    openGraph: openGraph(locale, `/collections/${collection.slug}`),
    // An empty collection is an honest empty page, not a search result: not indexed.
    ...(collection.productCount === 0 && { robots: { index: false, follow: true } }),
  };
}

/**
 * An occasion collection (#115): the listed products sellers tagged with it, with budget
 * links and the usual catalog filters. Empty: an honest empty state, never sample items.
 */
export default async function CollectionPage({
  params,
  searchParams,
}: PageProps<"/[locale]/collections/[slug]">) {
  const { slug } = await params;
  const [t, tc, locale, collections, share] = await Promise.all([
    getTranslations("Collections"),
    getTranslations("Catalog"),
    getLocale(),
    api.listCollections(),
    shareLabels(),
  ]);
  const collection = collections.find((c) => c.slug === slug);
  if (!collection) notFound();
  const name = collection.name[locale];
  const others = collections.filter((c) => c.id !== collection.id && c.productCount > 0);
  const faq = FAQ_KEYS.map((k) => ({ q: t(`faq.${k}.q`, { name }), a: t(`faq.${k}.a`, { name }) }));
  const empty = collection.productCount === 0;

  return (
    <div className="container-page py-8 sm:py-12">
      <JsonLd
        data={[
          breadcrumbs([
            { name: t("title"), path: `/${locale}/collections` },
            { name, path: `/${locale}/collections/${collection.slug}` },
          ]),
          ...(empty ? [] : [faqPage(faq)]),
        ]}
      />
      <nav aria-label={t("breadcrumb")} className="mb-4 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link
              href="/collections"
              className="inline-flex min-h-11 items-center hover:text-foreground sm:min-h-0"
            >
              {t("title")}
            </Link>
          </li>
          <li aria-current="page" className="text-foreground before:mr-1 before:content-['/']">
            {name}
          </li>
        </ol>
      </nav>
      <div className="mb-2 flex items-start justify-between gap-4">
        <h1 className="min-w-0 text-3xl sm:text-4xl">{name}</h1>
        {!empty && <ShareButton labels={share} title={name} className="shrink-0" />}
      </div>
      <p className="mb-2 max-w-2xl text-muted-foreground">{t("collectionDescription", { name })}</p>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">{t("source")}</p>

      {empty ? (
        <ProductGridEmpty title={t("emptyTitle")} text={t("emptyText")}>
          <Link
            href="/products"
            className="mt-2 inline-flex min-h-11 items-center link-underline text-sm font-medium"
          >
            {t("browseCatalog")}
          </Link>
        </ProductGridEmpty>
      ) : (
        <>
          <Suspense fallback={null}>
            <CollectionBudgets slug={collection.slug} searchParams={searchParams} />
          </Suspense>
          <Suspense fallback={<ProductGridSkeleton label={tc("loading")} />}>
            <Catalog
              searchParams={searchParams}
              action={`/collections/${collection.slug}`}
              collection={collection.slug}
              listName={name}
            />
          </Suspense>
        </>
      )}

      {others.length > 0 && (
        <section aria-labelledby="collection-others" className="mt-16">
          <h2 id="collection-others" className="mb-4 text-2xl">
            {t("others")}
          </h2>
          <CollectionLinks collections={others} label={t("others")} />
        </section>
      )}

      {!empty && (
        <Reveal as="section" aria-labelledby="collection-faq" className="mt-16 max-w-3xl">
          <h2 id="collection-faq" className="mb-4 text-2xl">
            {t("faqTitle", { name })}
          </h2>
          <FaqList items={faq} />
        </Reveal>
      )}
    </div>
  );
}
