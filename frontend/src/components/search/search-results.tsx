import { ArrowRight, Search, SearchX } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Pagination } from "@/components/catalog/catalog-toolbar";
import { FilterForm } from "@/components/catalog/filter-form";
import { CategoryTiles } from "@/components/categories/category-tiles";
import { ProductGrid } from "@/components/product/product-grid";
import { StoreCard } from "@/components/stores/store-card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { parseFilters, type SearchParams } from "@/lib/catalog/filters";
import type { Category, SearchResult, StoreSummary } from "@/types/api";
import { cn } from "cn";

export const SEARCH_TABS = ["all", "products", "stores", "categories"] as const;
export type SearchTab = (typeof SEARCH_TABS)[number];

/** Each tab is its own path so the product filters (which own the query string) keep working. */
export const tabPath = (tab: SearchTab) => (tab === "all" ? "/search" : `/search/${tab}`);

const PREVIEW = { stores: 3, categories: 4, products: 8 } as const;

function readQuery(sp: SearchParams): string {
  const v = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  return v?.trim().slice(0, 100) ?? "";
}

/**
 * Everything on /search that depends on the query: the box, the tabs with counts and
 * the results. Streams inside Suspense; the page heading stays in the static shell.
 */
export async function SearchResults({
  tab,
  searchParams,
}: {
  tab: SearchTab;
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = readQuery(sp);
  // The products tab pages through the same ranked search the counts come from (#41 review:
  // the catalog's word-start filter found fewer products than "Products N" promised).
  const page = tab === "products" ? (parseFilters(sp).page ?? 0) : 0;
  const [t, result, categories] = await Promise.all([
    getTranslations("SearchPage"),
    q ? api.search(q, "all", page) : Promise.resolve(null),
    api.listCategories(),
  ]);
  const topCategories = categories.filter((c) => c.parentId === null && c.productCount > 0);

  return (
    <div className="flex flex-col gap-6">
      <FilterForm action={tabPath(tab)} className="flex gap-2">
        <label className="sr-only" htmlFor="search-q">
          {t("label")}
        </label>
        <span className="relative flex-1">
          <Search
            aria-hidden
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id="search-q"
            type="search"
            name="q"
            defaultValue={q}
            placeholder={t("placeholder")}
            enterKeyHint="search"
            className="h-11 w-full rounded-md border border-input bg-background pr-3 pl-9 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </span>
        <Button type="submit" className="h-11">
          {t("submit")}
        </Button>
      </FilterForm>

      {!result ? (
        <EmptyState title={t("startTitle")} text={t("startText")} categories={topCategories} />
      ) : (
        <>
          <Tabs tab={tab} q={q} result={result} />
          <TabPanel tab={tab} q={q} result={result} categories={topCategories} />
        </>
      )}
    </div>
  );
}

async function Tabs({ tab, q, result }: { tab: SearchTab; q: string; result: SearchResult }) {
  const t = await getTranslations("SearchPage");
  const counts: Record<SearchTab, number> = {
    products: result.products.totalElements,
    stores: result.stores.length,
    categories: result.categories.length,
    all: 0,
  };
  counts.all = counts.products + counts.stores + counts.categories;
  return (
    <nav aria-label={t("tabs")} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b">
        {SEARCH_TABS.map((key) => (
          <li key={key}>
            <Link
              href={`${tabPath(key)}?q=${encodeURIComponent(q)}`}
              // Tabs and "see all" re-run the search: fetched on click, not while loading (#160).
              prefetch={false}
              aria-current={key === tab ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                key === tab
                  ? "border-gold text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`tab.${key}`)}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">
                {counts[key]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

async function TabPanel({
  tab,
  q,
  result,
  categories,
}: {
  tab: SearchTab;
  q: string;
  result: SearchResult;
  categories: Category[];
}) {
  const t = await getTranslations("SearchPage");
  const empty = (
    <EmptyState
      title={t("emptyTitle", { query: q })}
      text={t("emptyText")}
      categories={categories}
    />
  );

  if (tab === "products")
    return result.products.totalElements ? (
      <div className="flex flex-col gap-6">
        <h2 className="sr-only">{t("tab.products")}</h2>
        <ProductGrid products={result.products.content} />
        <Pagination
          action={tabPath("products")}
          filters={{ q }}
          page={result.products.page}
          totalPages={result.products.totalPages}
        />
      </div>
    ) : (
      empty
    );
  if (tab === "stores") return result.stores.length ? <StoreGrid stores={result.stores} /> : empty;
  if (tab === "categories")
    return result.categories.length ? <CategoryTiles categories={result.categories} /> : empty;

  const total = result.products.totalElements + result.stores.length + result.categories.length;
  if (total === 0) return empty;

  const seeAll = (key: SearchTab, count: number) => (
    <Link
      href={`${tabPath(key)}?q=${encodeURIComponent(q)}`}
      prefetch={false}
      className="inline-flex items-center gap-1 link-underline text-sm font-medium"
    >
      {t("seeAll", { count })}
      <ArrowRight aria-hidden className="size-4" />
    </Link>
  );

  return (
    <div className="flex flex-col gap-10">
      {result.stores.length > 0 && (
        <Section
          title={t("tab.stores")}
          action={result.stores.length > PREVIEW.stores && seeAll("stores", result.stores.length)}
        >
          <StoreGrid stores={result.stores.slice(0, PREVIEW.stores)} />
        </Section>
      )}
      {result.categories.length > 0 && (
        <Section
          title={t("tab.categories")}
          action={
            result.categories.length > PREVIEW.categories &&
            seeAll("categories", result.categories.length)
          }
        >
          <CategoryTiles
            categories={result.categories.slice(0, PREVIEW.categories)}
            reveal={false}
          />
        </Section>
      )}
      {result.products.totalElements > 0 && (
        <Section
          title={t("tab.products")}
          action={
            result.products.totalElements > PREVIEW.products &&
            seeAll("products", result.products.totalElements)
          }
        >
          <ProductGrid products={result.products.content.slice(0, PREVIEW.products)} />
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-2xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function StoreGrid({ stores }: { stores: StoreSummary[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {stores.map((s) => (
        <li key={s.id}>
          <StoreCard store={s} />
        </li>
      ))}
    </ul>
  );
}

async function EmptyState({
  title,
  text,
  categories,
}: {
  title: string;
  text: string;
  categories: Category[];
}) {
  const [t, locale] = await Promise.all([getTranslations("SearchPage"), getLocale()]);
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center">
      <SearchX aria-hidden className="size-8 text-muted-foreground" />
      {/* The title quotes the query: a long unbroken query must wrap, not widen the page. */}
      <h2 className="max-w-full text-xl wrap-anywhere">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{text}</p>
      {categories.length > 0 && (
        <>
          <p className="mt-2 text-sm font-medium">{t("tryCategories")}</p>
          <ul className="flex flex-wrap justify-center gap-2">
            {categories.slice(0, 8).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/categories/${c.slug}`}
                  className="inline-flex h-8 items-center rounded-full border px-3 text-sm hover:bg-muted"
                >
                  {c.name[locale]}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
