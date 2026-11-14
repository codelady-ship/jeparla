import { ShieldCheck, Sparkles } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { ViewTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { ProductSummary, Verification } from "@/types/api";
import { ProductActions } from "./product-actions";
import { formatPrice, formatGrams } from "@/lib/money";

export const CARD_SIZES = "(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw";

/** Shown as "Jeparla Verified" only when both the seller and the documents passed. */
export function isVerified(v: Verification) {
  return v.seller === "VERIFIED" && v.documents === "VERIFIED";
}

type Props = {
  product: ProductSummary;
  /** Preload the image: only for cards in the first visible row (LCP). */
  preload?: boolean;
};

export function ProductCard({ product: p, preload = false }: Props) {
  const t = useTranslations("Product");
  const locale = useLocale();
  const [main, second] = p.images;
  const svg = (url: string) => url.endsWith(".svg");

  return (
    <article className="group relative flex w-full min-w-0 flex-col">
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-muted">
        {main && (
          <ViewTransition name={`product-${p.id}`} share="morph" default="none">
            <Image
              src={main.url}
              alt={main.alt[locale]}
              fill
              sizes={CARD_SIZES}
              preload={preload}
              fetchPriority={preload ? "high" : undefined}
              unoptimized={svg(main.url)}
              className="img-zoom object-cover"
            />
          </ViewTransition>
        )}
        {second && (
          <Image
            src={second.url}
            alt=""
            fill
            sizes={CARD_SIZES}
            unoptimized={svg(second.url)}
            className="img-swap object-cover"
          />
        )}
        <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {isVerified(p.verification) && (
            <Badge variant="gold">
              <ShieldCheck aria-hidden />
              {t("verified")}
            </Badge>
          )}
          {main?.aiGenerated && (
            <Badge variant="secondary">
              <Sparkles aria-hidden />
              {t("aiImage")}
            </Badge>
          )}
          {p.stockStatus !== "IN_STOCK" && (
            <Badge variant="secondary">{t(`stock.${p.stockStatus}`)}</Badge>
          )}
        </div>
        <ProductActions
          id={p.id}
          variantId={p.defaultVariantId}
          price={p.priceFrom}
          labels={{
            favoriteAdd: t("favoriteAdd"),
            favoriteRemove: t("favoriteRemove"),
            compareAdd: t("compareAdd"),
            compareRemove: t("compareRemove"),
            compareFull: t("compareFull"),
            compareOpen: t("compareOpen"),
          }}
        />
      </div>
      <div className="mt-3 flex flex-1 flex-col gap-1">
        <p className="truncate text-xs text-muted-foreground">{p.store.name}</p>
        <h3 className="line-clamp-2 font-sans text-sm leading-snug font-medium">
          {/* The overlay makes the whole card clickable; the action buttons sit above it. */}
          <Link
            href={`/products/${p.slug}`}
            // No viewport prefetch: a grid of cards would fetch every product page while
            // the catalog is still loading (#160). Navigation fetches on click.
            prefetch={false}
            className="outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
          >
            {p.name[locale]}
          </Link>
        </h3>
        <p className="text-xs text-muted-foreground">
          {t("specs", {
            metal: t(`metal.${p.metal}`),
            fineness: p.fineness,
            weight: formatGrams(p.weightGrams, locale),
          })}
        </p>
        <p className="mt-auto pt-1 font-semibold tabular-nums">
          {formatPrice(p.priceFrom.amount, locale)}
        </p>
      </div>
    </article>
  );
}
