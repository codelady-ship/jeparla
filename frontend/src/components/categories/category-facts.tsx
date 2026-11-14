import { getLocale, getTranslations } from "next-intl/server";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/money";
import { isRealPrice } from "@/lib/seo/json-ld";
import type { Category } from "@/types/api";

/**
 * A short, quotable facts table for a category (issue #61): how many products and the
 * real price range, read from the catalog itself (cheapest and dearest product), in the
 * initial HTML. Nothing is estimated: a row without data is left out.
 */
export async function CategoryFacts({ category }: { category: Category }) {
  const [t, locale, cheapest, dearest] = await Promise.all([
    getTranslations("Categories"),
    getLocale(),
    api.listProducts({ category: category.slug, sort: "price_asc", size: 1 }),
    api.listProducts({ category: category.slug, sort: "price_desc", size: 1 }),
  ]);
  const name = category.name[locale];
  const low = cheapest.content[0]?.priceFrom;
  const high = dearest.content[0]?.priceFrom;
  const rows: [string, string][] = [
    [t("facts.products"), String(cheapest.totalElements)],
    ...(isRealPrice(low)
      ? [[t("facts.priceFrom"), formatPrice(low.amount, locale)] as [string, string]]
      : []),
    ...(isRealPrice(high)
      ? [[t("facts.priceTo"), formatPrice(high.amount, locale)] as [string, string]]
      : []),
  ];

  return (
    <section aria-labelledby="category-facts" className="mt-16 max-w-3xl">
      <h2 id="category-facts" className="mb-3 text-2xl">
        {t("factsTitle", { name })}
      </h2>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b last:border-0">
              <th scope="row" className="py-2 pr-4 text-left font-normal text-muted-foreground">
                {k}
              </th>
              <td className="py-2 text-right font-medium tabular-nums">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
