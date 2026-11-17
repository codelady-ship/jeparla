import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Catalog } from "@/components/catalog/catalog";
import { CategoryFacts } from "@/components/categories/category-facts";
import { Reveal } from "@/components/motion/reveal";
import { ProductGridSkeleton } from "@/components/product/product-grid";
import { JsonLd } from "@/components/seo/json-ld";
import { ShareButton } from "@/components/share/share-button";
import { shareLabels } from "@/components/share/share-labels";
import { alternates } from "@/i18n/alternates";
import { openGraph } from "@/lib/seo/open-graph";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { api } from "@/lib/api";
import { slugParams } from "@/lib/api/static-params";
import { breadcrumbs, faqPage } from "@/lib/seo/json-ld";
import { FaqList } from "@/components/faq-list";

const FAQ_KEYS = ["fineness", "price", "contact"] as const;

export async function generateStaticParams() {
  const categories = await api.listCategories();
  return slugParams(categories.map((c) => c.slug));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/categories/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const locale = await rootLocale();
  const categories = await api.listCategories();
  const c = categories.find((x) => x.slug === slug);
  // Resolved before the streamed body: an unknown category answers a real 404, not a soft 200.
  if (!c) notFound();
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Categories" });
  return {
    title: c.name[locale],
    description: t("categoryDescription", { name: c.name[locale] }),
    alternates: alternates(locale, `/categories/${c.slug}`),
    openGraph: openGraph(locale, `/categories/${c.slug}`),
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps<"/[locale]/categories/[slug]">) {
  const { slug } = await params;
  const [t, tc, locale, categories, share] = await Promise.all([
    getTranslations("Categories"),
    getTranslations("Catalog"),
    getLocale(),
    api.listCategories(),
    shareLabels(),
  ]);
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();
  const name = category.name[locale];
  const parent = categories.find((c) => c.id === category.parentId);
  const children = categories.filter((c) => c.parentId === category.id);
  const faq = FAQ_KEYS.map((k) => ({ q: t(`faq.${k}.q`, { name }), a: t(`faq.${k}.a`, { name }) }));

  return (
    <div className="container-page py-8 sm:py-12">
      <JsonLd
        data={[
          breadcrumbs([
            { name: t("title"), path: `/${locale}/categories` },
            ...(parent
              ? [{ name: parent.name[locale], path: `/${locale}/categories/${parent.slug}` }]
              : []),
            { name, path: `/${locale}/categories/${category.slug}` },
          ]),
          faqPage(faq),
        ]}
      />
      <nav aria-label={t("breadcrumb")} className="mb-4 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/categories" className="hover:text-foreground">
              {t("title")}
            </Link>
          </li>
          {parent && (
            <li className="before:mr-1 before:content-['/']">
              <Link href={`/categories/${parent.slug}`} className="hover:text-foreground">
                {parent.name[locale]}
              </Link>
            </li>
          )}
          <li aria-current="page" className="text-foreground before:mr-1 before:content-['/']">
            {name}
          </li>
        </ol>
      </nav>
      <div className="mb-2 flex items-start justify-between gap-4">
        <h1 className="min-w-0 text-3xl sm:text-4xl">{name}</h1>
        <ShareButton labels={share} title={name} className="shrink-0" />
      </div>
      <p className="mb-6 max-w-2xl text-muted-foreground">{t("categoryDescription", { name })}</p>

      {children.length > 0 && (
        <ul className="mb-8 flex flex-wrap gap-2" aria-label={t("subcategories")}>
          {children.map((c) => (
            <li key={c.id}>
              <Link
                href={`/categories/${c.slug}`}
                className="inline-flex h-9 items-center rounded-full border bg-card px-4 text-sm hover:bg-muted pointer-coarse:h-11"
              >
                {c.name[locale]}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Suspense fallback={<ProductGridSkeleton label={tc("loading")} />}>
        <Catalog
          searchParams={searchParams}
          action={`/categories/${category.slug}`}
          category={category.slug}
        />
      </Suspense>

      <CategoryFacts category={category} />

      <Reveal as="section" aria-labelledby="category-faq" className="mt-16 max-w-3xl">
        <h2 id="category-faq" className="mb-4 text-2xl">
          {t("faqTitle", { name })}
        </h2>
        <FaqList items={faq} />
      </Reveal>
    </div>
  );
}
