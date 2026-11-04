import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { activeFilters, SORTS, toQuery } from "@/lib/catalog/filters";
import type { ProductFilters } from "@/types/api";
import type { FilterData } from "./filter-fields";
import { FilterForm } from "./filter-form";
import { formatPrice } from "@/lib/money";

/** Sort select as its own GET form; current filters ride along as hidden fields. */
export function SortForm({ action, filters }: { action: string; filters: ProductFilters }) {
  const t = useTranslations("Catalog");
  const { sort, page: _page, ...rest } = filters;
  const hidden = [...new URLSearchParams(toQuery(rest))];
  return (
    <FilterForm action={action} auto className="flex items-center gap-2">
      {hidden.map(([k, v], i) => (
        <input key={`${k}-${i}`} type="hidden" name={k} value={v} />
      ))}
      <label htmlFor="sort" className="text-sm text-muted-foreground">
        {t("sortLabel")}
      </label>
      <select
        id="sort"
        name="sort"
        defaultValue={sort ?? ""}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="">{t("sort.relevance")}</option>
        {SORTS.map((s) => (
          <option key={s} value={s}>
            {t(`sort.${s}`)}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="text-sm underline">
          {t("apply")}
        </button>
      </noscript>
    </FilterForm>
  );
}

/** Removable chips for every active filter, plus "Clear all". */
export function ActiveFilterChips({
  action,
  filters,
  data,
}: {
  action: string;
  filters: ProductFilters;
  data: FilterData;
}) {
  const t = useTranslations("Catalog");
  const tp = useTranslations("Product");
  const locale = useLocale();
  const chips = activeFilters(filters);
  if (chips.length === 0) return null;

  const label = (key: keyof ProductFilters, value: string): string => {
    switch (key) {
      case "category":
        return data.categories.find((c) => c.slug === value)?.name[locale] ?? value;
      case "store":
        return data.stores.find((s) => s.slug === value)?.name ?? value;
      case "metal":
        return tp(`metal.${value as "GOLD"}`);
      case "shape":
        return t(`shapes.${value as "ROUND"}`);
      case "minPrice":
      case "maxPrice":
        return t(`chip.${key}`, { value: formatPrice(value, locale) });
      case "verified":
        return t("verifiedOnly");
      case "inStock":
        return t("inStockOnly");
      case "q":
      case "fineness":
      case "minWeight":
      case "maxWeight":
      case "minCarat":
      case "maxCarat":
      case "color":
      case "clarity":
        return t(`chip.${key}`, { value });
      default:
        return value;
    }
  };

  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label={t("activeFilters")}>
      {chips.map((c) => (
        <li key={`${c.key}-${c.value}`}>
          <Link
            href={`${action}${toQuery(c.without)}`}
            scroll={false}
            className="inline-flex h-8 items-center gap-1 rounded-full border bg-card px-3 text-sm hover:bg-muted"
            aria-label={t("removeFilter", { name: label(c.key, c.value) })}
          >
            {label(c.key, c.value)}
            <X aria-hidden className="size-3.5" />
          </Link>
        </li>
      ))}
      <li>
        <Link
          href={`${action}${toQuery({ sort: filters.sort })}`}
          scroll={false}
          className="link-underline text-sm font-medium"
        >
          {t("clearAll")}
        </Link>
      </li>
    </ul>
  );
}

export function Pagination({
  action,
  filters,
  page,
  totalPages,
}: {
  action: string;
  filters: ProductFilters;
  /** 0-based. */
  page: number;
  totalPages: number;
}) {
  const t = useTranslations("Catalog");
  if (totalPages <= 1) return null;
  const href = (p: number) => `${action}${toQuery({ ...filters, page: p })}`;
  const item =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm tabular-nums hover:bg-muted";
  return (
    <nav aria-label={t("pagination")} className="mt-12 flex justify-center">
      <ul className="flex flex-wrap items-center gap-2">
        {page > 0 && (
          <li>
            <Link href={href(page - 1)} className={item} rel="prev">
              {t("prev")}
            </Link>
          </li>
        )}
        {Array.from({ length: totalPages }, (_, p) => (
          <li key={p}>
            {p === page ? (
              <span aria-current="page" className={`${item} bg-primary text-primary-foreground`}>
                {p + 1}
              </span>
            ) : (
              <Link href={href(p)} className={item} aria-label={t("pageN", { n: p + 1 })}>
                {p + 1}
              </Link>
            )}
          </li>
        ))}
        {page < totalPages - 1 && (
          <li>
            <Link href={href(page + 1)} className={item} rel="next">
              {t("next")}
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
