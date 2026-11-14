"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { ProductGrid, ProductGridSkeleton } from "@/components/product/product-grid";
import { Button } from "@/components/ui/button";
import { favorites } from "@/lib/saved-list";
import { useFetchIds } from "@/lib/use-fetch-ids";
import { useSavedIds } from "@/lib/use-saved";
import type { ProductSummary } from "@/types/api";
import { PriceChanges } from "./price-changes";
import { SavedEmpty, SavedError } from "./saved-empty";

/** Guest favorites from localStorage, newest first. Synced to the account later (#24). */
export function FavoritesView() {
  const t = useTranslations("Saved");
  const ids = useSavedIds(favorites);
  const newestFirst = [...ids].reverse();
  const state = useFetchIds<ProductSummary>("/api/saved", newestFirst);

  if (state.status === "loading") return <ProductGridSkeleton count={4} label={t("loading")} />;
  if (state.status === "error")
    return <SavedError text={t("error")} retry={state.retry} label={t("retry")} />;
  // Cards removed meanwhile disappear at once, without waiting for a refetch.
  const products = state.data.filter((p) => ids.includes(p.id));
  if (products.length === 0)
    return (
      <SavedEmpty
        icon={Heart}
        title={t("favoritesEmptyTitle")}
        text={t("favoritesEmptyText")}
        cta={t("browse")}
      />
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t("favoritesCount", { count: products.length })}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={() => favorites.clear()}>
          {t("clearAll")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("deviceNote")}</p>
      <PriceChanges products={products} />
      <ProductGrid products={products} />
    </div>
  );
}
