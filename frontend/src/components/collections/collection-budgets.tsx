import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { COLLECTION_BUDGETS } from "@/lib/catalog/budgets";
import { parseFilters, type SearchParams } from "@/lib/catalog/filters";

const CHIP =
  "inline-flex min-h-11 items-center rounded-full border px-4 text-sm tabular-nums transition-colors hover:bg-muted aria-[current=true]:border-primary aria-[current=true]:bg-primary aria-[current=true]:text-primary-foreground aria-[current=true]:hover:bg-primary";

/**
 * Budget links of an occasion collection (#115): "up to 200 / 500 / 1 000 / 3 000 AZN" over
 * the collection's own products. A budget with nothing under it is not offered, and with no
 * budget left only the collection itself remains, so the row is left out. The links are plain
 * URLs (?maxPrice=), shareable like every catalog filter.
 */
export async function CollectionBudgets({
  slug,
  searchParams,
}: {
  slug: string;
  searchParams: Promise<SearchParams>;
}) {
  const [t, th, filters, pages] = await Promise.all([
    getTranslations("Collections"),
    getTranslations("Home"),
    searchParams.then(parseFilters),
    Promise.all(
      COLLECTION_BUDGETS.map((max) =>
        api.listProducts({ collection: slug, maxPrice: String(max), size: 1 }),
      ),
    ),
  ]);
  const budgets = COLLECTION_BUDGETS.filter((_, i) => pages[i].totalElements > 0);
  if (budgets.length === 0) return null;
  const path = `/collections/${slug}`;
  const active = filters.minPrice ? null : (filters.maxPrice ?? "");

  return (
    <nav aria-labelledby="collection-budget" className="mb-8">
      <h2 id="collection-budget" className="mb-3 font-sans text-sm font-semibold">
        {t("budget")}
      </h2>
      <ul className="flex flex-wrap gap-2">
        <li>
          <Link href={path} aria-current={active === "" ? "true" : undefined} className={CHIP}>
            {t("anyPrice")}
          </Link>
        </li>
        {budgets.map((max) => (
          <li key={max}>
            <Link
              href={`${path}?maxPrice=${max}`}
              aria-current={active === String(max) ? "true" : undefined}
              className={CHIP}
            >
              {th("budget.upTo", { amount: max })}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
