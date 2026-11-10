"use client";

import { GitCompareArrows, Heart } from "lucide-react";
import { notices } from "@/lib/notice";
import { compare, favorites } from "@/lib/saved-list";
import { useSavedIds } from "@/lib/use-saved";
import { cn } from "cn";

export type ProductActionLabels = {
  favoriteAdd: string;
  favoriteRemove: string;
  compareAdd: string;
  compareRemove: string;
  /** Explains the limit of 4 when a 5th item is added. */
  compareFull: string;
  compareOpen: string;
};

/** Adds a variant to compare, or explains why it cannot (limit of 4). */
export function toggleCompare(variantId: number, labels: ProductActionLabels) {
  if (compare.toggle(variantId) === "full") {
    notices.show(labels.compareFull, { href: "/compare", label: labels.compareOpen });
  }
}

const button =
  "relative inline-flex size-9 items-center justify-center rounded-full bg-background/90 after:absolute after:-inset-1 after:content-[''] text-foreground shadow-sm transition-colors outline-none hover:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-4";

export function ProductActions({
  id,
  variantId,
  labels,
}: {
  id: number;
  /** Compare works per variant; a card adds the variant its "from" price belongs to. */
  variantId: number;
  labels: ProductActionLabels;
}) {
  const isFavorite = useSavedIds(favorites).includes(id);
  const isCompared = useSavedIds(compare).includes(variantId);

  return (
    <div className="absolute top-2 right-2 z-10 flex flex-col gap-2">
      <button
        type="button"
        className={button}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? labels.favoriteRemove : labels.favoriteAdd}
        onClick={() => favorites.toggle(id)}
      >
        <Heart aria-hidden className={cn(isFavorite && "fill-current text-gold-text")} />
      </button>
      <button
        type="button"
        className={button}
        aria-pressed={isCompared}
        aria-label={isCompared ? labels.compareRemove : labels.compareAdd}
        onClick={() => toggleCompare(variantId, labels)}
      >
        <GitCompareArrows aria-hidden className={cn(isCompared && "text-gold-text")} />
      </button>
    </div>
  );
}
