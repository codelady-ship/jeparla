"use client";

import { GitCompareArrows, Heart } from "lucide-react";
import { useSyncExternalStore } from "react";
import { compare, favorites, type SavedList } from "@/lib/saved-list";
import { cn } from "cn";

export type ProductActionLabels = {
  favoriteAdd: string;
  favoriteRemove: string;
  compareAdd: string;
  compareRemove: string;
};

const NONE: readonly number[] = [];
const serverSnapshot = () => NONE;

function useSaved(list: SavedList, id: number) {
  const ids = useSyncExternalStore(list.subscribe, list.get, serverSnapshot);
  return ids.includes(id);
}

const button =
  "inline-flex size-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm transition-colors outline-none hover:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-4";

export function ProductActions({ id, labels }: { id: number; labels: ProductActionLabels }) {
  const isFavorite = useSaved(favorites, id);
  const isCompared = useSaved(compare, id);

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
        onClick={() => compare.toggle(id)}
      >
        <GitCompareArrows aria-hidden className={cn(isCompared && "text-gold-text")} />
      </button>
    </div>
  );
}
