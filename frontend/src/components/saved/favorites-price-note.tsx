"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { readCheck, readSeen, SEEN_EVENT, unseenChanges, writeCheck } from "@/lib/price-seen";
import { readSavedPrices } from "@/lib/saved-prices";
import { favorites } from "@/lib/saved-list";
import { useSavedIds } from "@/lib/use-saved";
import type { ProductSummary } from "@/types/api";

/** After the page settled: the check never competes with the first paint. */
const DELAY_MS = 3000;

/**
 * A quiet mark on the header's favourites link (#112): a small dot when favourites changed
 * price since the visitor last opened the favourites page, with the count read out after the
 * link label. Nothing pops up; the details are on the favourites page itself. The current
 * prices are asked at most once an hour per tab, and only when there are favourites.
 */
export function FavoritesPriceNote() {
  const t = useTranslations("Common");
  const ids = useSavedIds(favorites);
  const key = ids.join(",");
  const [result, setResult] = useState<{ key: string; count: number }>({ key: "", count: 0 });

  useEffect(() => {
    if (key === "") return;
    const cached = readCheck(key);
    const ctrl = new AbortController();
    const timer = setTimeout(
      () => {
        if (cached) return setResult({ key, count: cached.count });
        fetch(`/api/saved?ids=${key}`, { signal: ctrl.signal })
          .then((res) => (res.ok ? (res.json() as Promise<ProductSummary[]>) : null))
          .then((products) => {
            if (!products) return;
            const count = unseenChanges(products, readSavedPrices(), readSeen());
            writeCheck({ ids: key, count, at: Date.now() });
            setResult({ key, count });
          })
          .catch(() => {
            // Offline or aborted: no note rather than a wrong one.
          });
      },
      cached ? 0 : DELAY_MS,
    );
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [key]);

  useEffect(() => {
    const seen = () => setResult((r) => ({ ...r, count: 0 }));
    window.addEventListener(SEEN_EVENT, seen);
    return () => window.removeEventListener(SEEN_EVENT, seen);
  }, []);

  const count = result.key === key ? result.count : 0;
  if (count === 0) return null;
  return (
    <>
      <span
        aria-hidden
        className="absolute right-0.5 bottom-0.5 size-2 rounded-full bg-gold-text ring-2 ring-background"
      />
      <span className="sr-only">{t("favoritesPriceChanged", { count })}</span>
    </>
  );
}
