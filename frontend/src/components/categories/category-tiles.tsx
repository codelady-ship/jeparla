import { Gem } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Reveal } from "@/components/motion/reveal";
import { Link } from "@/i18n/navigation";
import type { Category } from "@/types/api";

/**
 * Category tiles. No photos yet (stores upload them later), so a quiet surface with
 * the gem mark; the mark zooms slowly on hover like product images do.
 */
export function CategoryTiles({
  categories,
  reveal = true,
}: {
  categories: Category[];
  reveal?: boolean;
}) {
  const t = useTranslations("Categories");
  const locale = useLocale();
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {categories.map((c, i) => {
        const tile = (
          <Link
            href={`/categories/${c.slug}`}
            className="group flex h-full flex-col justify-between gap-6 overflow-hidden rounded-lg border bg-card p-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <span className="flex h-16 items-center">
              <Gem aria-hidden className="size-8 img-zoom text-gold-text" />
            </span>
            <span className="flex flex-col gap-1">
              <span className="self-start link-underline font-heading text-lg">
                {c.name[locale]}
              </span>
              <span className="text-sm text-muted-foreground">
                {t("productCount", { count: c.productCount })}
              </span>
            </span>
          </Link>
        );
        return reveal ? (
          <Reveal key={c.id} as="li" index={i % 4}>
            {tile}
          </Reveal>
        ) : (
          <li key={c.id}>{tile}</li>
        );
      })}
    </ul>
  );
}
