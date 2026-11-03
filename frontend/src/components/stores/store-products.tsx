import { Search } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Pagination } from "@/components/catalog/catalog-toolbar";
import { FilterForm } from "@/components/catalog/filter-form";
import { ProductGrid, ProductGridEmpty } from "@/components/product/product-grid";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { PAGE_SIZE, parseFilters, type SearchParams } from "@/lib/catalog/filters";

const field =
  "h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/** Products of one store with in-store search and a category filter. */
export async function StoreProducts({
  slug,
  searchParams,
}: {
  slug: string;
  searchParams: Promise<SearchParams>;
}) {
  const { q, category, page } = parseFilters(await searchParams);
  const filters = { q, category, page };
  const action = `/stores/${slug}`;
  const [t, locale, result, all, categories] = await Promise.all([
    getTranslations("Stores"),
    getLocale(),
    api.listStoreProducts(slug, { ...filters, size: PAGE_SIZE }),
    api.listStoreProducts(slug, { size: 96 }),
    api.listCategories(),
  ]);
  // Only categories this store actually has, parents included.
  const used = new Set(all.content.map((p) => p.categoryId));
  for (const c of categories) if (used.has(c.id) && c.parentId) used.add(c.parentId);
  const options = categories.filter((c) => used.has(c.id));

  return (
    <div className="flex flex-col gap-6">
      <FilterForm action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          {t("searchInStore")}
          <span className="relative">
            <Search
              aria-hidden
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input type="search" name="q" defaultValue={q} className={`${field} w-full pl-9`} />
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("category")}
          <select name="category" defaultValue={category ?? ""} className={field}>
            <option value="">{t("allCategories")}</option>
            {options.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.parentId ? `— ${c.name[locale]}` : c.name[locale]}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" className="h-10">
          {t("search")}
        </Button>
      </FilterForm>

      <ProductGrid
        products={result.content}
        empty={
          <ProductGridEmpty title={t("noProductsTitle")} text={t("noProductsText")}>
            <Link href={action} className="mt-2 link-underline text-sm font-medium">
              {t("showAllProducts")}
            </Link>
          </ProductGridEmpty>
        }
      />
      <Pagination
        action={action}
        filters={filters}
        page={result.page}
        totalPages={result.totalPages}
      />
    </div>
  );
}
