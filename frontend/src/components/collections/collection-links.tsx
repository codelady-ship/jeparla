import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { OccasionCollection } from "@/types/api";

/**
 * Occasion collections as quiet links with their product count (#115). Callers pass only
 * collections with products: an empty one is never offered as an entry point.
 */
export function CollectionLinks({
  collections,
  label,
}: {
  collections: OccasionCollection[];
  /** Accessible name of the list. */
  label: string;
}) {
  const t = useTranslations("Collections");
  const locale = useLocale();
  return (
    <ul aria-label={label} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {collections.map((c) => (
        <li key={c.id}>
          <Link
            href={`/collections/${c.slug}`}
            className="group flex min-h-16 items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3 outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <span className="link-underline font-heading text-lg">{c.name[locale]}</span>
            <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
              {t("productCount", { count: c.productCount })}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
