import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { OccasionCollection } from "@/types/api";

/** Two cards a row on phones, three from 1024px: the image is about half or a third of the page. */
const COVER_SIZES = "(min-width: 1280px) 400px, (min-width: 1024px) 31vw, 47vw";

/**
 * Occasion collections as photo cards (#115). The cover is a real photo of a product tagged
 * with the collection (chosen by the API, never AI or stock); without one the card keeps the
 * deep scene green. Callers pass only collections with products: an empty one is never offered.
 * Images load lazily: these cards are never the largest paint of a page.
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
    <ul aria-label={label} className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-6">
      {collections.map((c) => (
        <li key={c.id}>
          <Link
            href={`/collections/${c.slug}`}
            className="group relative isolate block aspect-[4/5] overflow-hidden rounded-xl bg-scene-deep outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {/* Text first: the link is named by the collection, then the photo's description. */}
            <span className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1 p-3 sm:p-5">
              <span className="font-heading text-xl leading-tight text-balance text-scene-ivory sm:text-3xl">
                {c.name[locale]}
              </span>
              <span className="flex items-center gap-1.5 text-sm text-scene-ivory-muted tabular-nums">
                {t("productCount", { count: c.productCount })}
                <ArrowRight
                  aria-hidden
                  className="size-4 transition-transform duration-300 ease-out motion-safe:group-hover:translate-x-1"
                />
              </span>
            </span>
            {c.cover && (
              <Image
                src={c.cover.url}
                alt={c.cover.alt[locale]}
                fill
                sizes={COVER_SIZES}
                unoptimized={c.cover.url.endsWith(".svg")}
                className="-z-10 img-zoom object-cover"
              />
            )}
            <span aria-hidden className="cover-scrim absolute inset-0 -z-10" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
