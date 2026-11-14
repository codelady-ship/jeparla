import { getTranslations } from "next-intl/server";
import { ProductGrid, ProductGridEmpty } from "@/components/product/product-grid";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { activeFilters, PAGE_SIZE, parseFilters, type SearchParams } from "@/lib/catalog/filters";
import { getLocale } from "next-intl/server";
import { ActiveFilterChips, Pagination, SortForm } from "./catalog-toolbar";
import { FilterFields, type FilterData } from "./filter-fields";
import { FilterSlot, FiltersProvider, FiltersSheet } from "./filters-sheet";

/**
 * Filters, results and pagination. Reads the query, so it streams.
 * On /products everything is in the URL; a category page passes `category` and
 * `action`, which fixes the category and hides its filter.
 */
export async function Catalog({
  searchParams,
  action: ACTION = "/products",
  category,
}: {
  searchParams: Promise<SearchParams>;
  action?: string;
  category?: string;
}) {
  const parsed = parseFilters(await searchParams);
  // UI state (chips, links) leaves the fixed category out; the API query includes it.
  const filters = category ? { ...parsed, category: undefined } : parsed;
  const [t, tc, locale, page, categories, stores, finenesses] = await Promise.all([
    getTranslations("Catalog"),
    getTranslations("Common"),
    getLocale(),
    api.listProducts({ ...filters, ...(category && { category }), size: PAGE_SIZE }),
    api.listCategories(),
    api.listStores(),
    api.listFinenesses(),
  ]);
  const data: FilterData = {
    categories,
    stores,
    finenesses,
    cities: [...new Set(stores.map((s) => s.city))].sort((a, b) => a.localeCompare(b, locale)),
  };
  const activeCount = activeFilters(filters).length;
  const suggestions = categories
    .filter((c) => c.parentId === null && c.productCount > 0)
    .slice(0, 6);

  return (
    <FiltersProvider>
      <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside aria-label={t("filters")} className="hidden lg:block">
          {/* Rendered once; the mobile sheet borrows these fields while it is open. */}
          <FilterSlot action={ACTION}>
            <FilterFields id="f" filters={filters} data={data} hideCategory={Boolean(category)} />
          </FilterSlot>
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FiltersSheet
                labels={{ open: t("filters"), title: t("filters"), close: tc("close") }}
                count={activeCount}
              />
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {t("count", { count: page.totalElements })}
              </p>
            </div>
            <SortForm action={ACTION} filters={filters} />
          </div>

          <ActiveFilterChips action={ACTION} filters={filters} data={data} />
          {/* Keeps heading order h1 > h2 > h3 (card titles) for screen readers. */}
          <h2 className="sr-only">{t("results")}</h2>

          <ProductGrid
            products={page.content}
            empty={
              <ProductGridEmpty title={t("emptyTitle")} text={t("emptyText")}>
                <ul className="mt-2 flex flex-wrap justify-center gap-2">
                  {suggestions.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`${ACTION}?category=${c.slug}`}
                        className="inline-flex h-8 items-center rounded-full border px-3 text-sm hover:bg-muted pointer-coarse:h-11 pointer-coarse:px-4"
                      >
                        {c.name[locale]}
                      </Link>
                    </li>
                  ))}
                </ul>
                {activeCount > 0 && (
                  <Link href={ACTION} className="mt-2 link-underline text-sm font-medium">
                    {t("clearAll")}
                  </Link>
                )}
              </ProductGridEmpty>
            }
          />

          <Pagination
            action={ACTION}
            filters={filters}
            page={page.page}
            totalPages={page.totalPages}
          />
        </div>
      </div>
    </FiltersProvider>
  );
}
