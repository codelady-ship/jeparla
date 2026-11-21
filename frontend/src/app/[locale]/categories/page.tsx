import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { CategoryTiles } from "@/components/categories/category-tiles";
import { CollectionLinks } from "@/components/collections/collection-links";
import { JsonLd } from "@/components/seo/json-ld";
import { itemList } from "@/lib/seo/json-ld";
import { alternates } from "@/i18n/alternates";
import { openGraph } from "@/lib/seo/open-graph";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { api } from "@/lib/api";

export async function generateMetadata(): Promise<Metadata> {
  "use cache";
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Categories" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: alternates(locale, "/categories"),
    openGraph: openGraph(locale, "/categories"),
  };
}

export default async function CategoriesPage() {
  const [t, tc, locale, categories, collections] = await Promise.all([
    getTranslations("Categories"),
    getTranslations("Collections"),
    getLocale(),
    api.listCategories(),
    // Occasion collections (#115) are a second way in; the page works without them.
    api.listCollections().catch(() => []),
  ]);
  const roots = categories.filter((c) => c.parentId === null);
  const occasions = collections.filter((c) => c.productCount > 0);
  return (
    <div className="container-page py-8 sm:py-12">
      <JsonLd
        data={[
          itemList(
            t("title"),
            roots.map((c) => ({ name: c.name[locale], path: `/${locale}/categories/${c.slug}` })),
          ),
        ]}
      />
      <h1 className="mb-2 text-3xl sm:text-4xl">{t("title")}</h1>
      <p className="mb-8 max-w-2xl text-muted-foreground">{t("intro")}</p>
      <CategoryTiles categories={roots} />
      {occasions.length > 0 && (
        <section aria-labelledby="categories-occasions" className="mt-16">
          <h2 id="categories-occasions" className="mb-2 text-2xl">
            <Link href="/collections" className="link-underline">
              {tc("title")}
            </Link>
          </h2>
          <p className="mb-6 max-w-2xl text-sm text-muted-foreground">{tc("intro")}</p>
          <CollectionLinks collections={occasions} label={tc("title")} />
        </section>
      )}
    </div>
  );
}
