"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useSyncExternalStore } from "react";
import { markPricesSeen } from "@/lib/price-seen";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatPrice } from "@/lib/money";
import { priceChange, readSavedPrices, type SavedPrice } from "@/lib/saved-prices";
import type { ProductSummary } from "@/types/api";

const noop = () => () => {};
const none: Record<string, SavedPrice> = {};
let cache: { raw: string | null; value: Record<string, SavedPrice> } = { raw: null, value: none };
// Stable snapshot: re-parse only when the stored text changed.
function snapshot(): Record<string, SavedPrice> {
  let raw: string | null = null;
  try {
    raw = globalThis.localStorage?.getItem("jeparla-favorite-prices") ?? null;
  } catch {
    return none;
  }
  if (raw !== cache.raw) cache = { raw, value: readSavedPrices() };
  return cache.value;
}

/**
 * "Since you added it" price notes on the favourites page (#112). Only products whose
 * price moved are listed; when nothing moved the block is not rendered at all.
 * Up and down are told by icon and words, not by colour alone.
 */
export function PriceChanges({ products }: { products: ProductSummary[] }) {
  const t = useTranslations("Saved.priceChanges");
  const locale = useLocale() as Locale;
  const saved = useSyncExternalStore(noop, snapshot, () => none);
  // The visitor sees every change here, so the header note (#112) goes quiet until a price moves again.
  const seenKey = products
    .map((p) => `${p.id}:${p.priceFrom.amount}${p.priceFrom.currency}`)
    .join();
  useEffect(() => {
    markPricesSeen(products);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seenKey stands for the prices shown
  }, [seenKey]);

  const changed = products.flatMap((p) => {
    const before = saved[p.id];
    const change = priceChange(before, p.priceFrom);
    return change && before ? [{ p, before, change }] : [];
  });
  if (changed.length === 0) return null;

  return (
    <section aria-labelledby="price-changes" className="rounded-lg border bg-card p-4 sm:p-5">
      <h2 id="price-changes" className="text-lg font-semibold">
        {t("title")}
      </h2>
      <ul className="mt-3 flex flex-col divide-y">
        {changed.map(({ p, before, change }) => {
          const Icon = change.direction === "up" ? TrendingUp : TrendingDown;
          const difference = formatPrice(change.difference, locale);
          return (
            <li key={p.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-gold-text" />
              <div className="min-w-0 text-sm">
                <Link
                  href={`/products/${p.slug}`}
                  prefetch={false}
                  className="link-underline font-medium"
                >
                  {p.name[locale]}
                </Link>
                <p className="tabular-nums">
                  {t("item", {
                    before: formatPrice(before.amount, locale),
                    now: formatPrice(p.priceFrom.amount, locale),
                  })}
                  {" · "}
                  <strong className="font-semibold">{t(change.direction, { difference })}</strong>
                </p>
                <p className="text-muted-foreground">{t(`reason.${p.pricingMode}`)}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">{t("note")}</p>
    </section>
  );
}
