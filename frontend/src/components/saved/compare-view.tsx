"use client";

import { GitCompareArrows, X } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { isVerified } from "@/components/product/product-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { compare, MAX_COMPARE } from "@/lib/saved-list";
import { useFetchIds } from "@/lib/use-fetch-ids";
import { useSavedIds } from "@/lib/use-saved";
import type { CompareItem } from "@/types/api";
import { cn } from "cn";
import { SavedEmpty, SavedError } from "./saved-empty";
import { formatPrice, formatGrams } from "@/lib/money";

/**
 * Side-by-side table of up to 4 variants. On a phone the table scrolls sideways
 * and the row labels stay pinned on the left.
 */
export function CompareView() {
  const t = useTranslations("Saved");
  const tp = useTranslations("Product");
  const td = useTranslations("Pdp");
  const locale = useLocale();
  const ids = useSavedIds(compare);
  const state = useFetchIds<CompareItem>("/api/compare", ids);

  if (state.status === "loading")
    return (
      <div
        aria-busy="true"
        aria-label={t("loading")}
        className="grid grid-cols-2 gap-4 md:grid-cols-4"
      >
        {Array.from({ length: Math.max(ids.length, 2) }, (_, i) => (
          <Skeleton key={i} className="h-96 rounded-lg" />
        ))}
      </div>
    );
  if (state.status === "error")
    return <SavedError text={t("error")} retry={state.retry} label={t("retry")} />;

  const items = state.data.filter((x) => ids.includes(x.variant.id));
  if (items.length === 0)
    return (
      <SavedEmpty
        icon={GitCompareArrows}
        title={t("compareEmptyTitle")}
        text={t("compareEmptyText", { max: MAX_COMPARE })}
        cta={t("browse")}
      />
    );

  const weight = (g: string) => formatGrams(g, locale);
  const differs = (values: string[]) => new Set(values).size > 1;

  const rows: { label: string; values: ReactNode[]; raw: string[] }[] = [
    {
      label: td("facts.price"),
      raw: items.map((x) => x.variant.price.amount),
      values: items.map((x) => (
        <span key={x.variant.id} className="font-semibold tabular-nums">
          {formatPrice(x.variant.price.amount, locale)}
        </span>
      )),
    },
    {
      label: td("facts.pricing"),
      raw: items.map((x) => x.variant.pricingMode),
      values: items.map((x) => td(`pricing.${x.variant.pricingMode}`)),
    },
    {
      label: td("facts.metal"),
      raw: items.map((x) => x.product.metal),
      values: items.map((x) => tp(`metal.${x.product.metal}`)),
    },
    {
      label: td("facts.fineness"),
      raw: items.map((x) => String(x.variant.fineness.value)),
      values: items.map((x) => x.variant.fineness.label),
    },
    {
      label: td("facts.weight"),
      raw: items.map((x) => x.variant.weightGrams),
      values: items.map((x) => weight(x.variant.weightGrams)),
    },
    {
      label: td("facts.size"),
      raw: items.map((x) => x.variant.size ?? ""),
      values: items.map((x) => x.variant.size ?? td("na")),
    },
    {
      label: td("stonesTitle"),
      raw: items.map((x) => x.stones.map((s) => s.type + s.carat).join()),
      values: items.map((x) =>
        x.stones.length === 0
          ? t("noStones")
          : x.stones
              .map((s) =>
                [
                  `${s.count > 1 ? `${s.count} × ` : ""}${td(`stoneType.${s.type}`)}`,
                  s.carat && `${s.carat} ct`,
                  s.color,
                  s.clarity,
                  s.origin === "LAB_GROWN" && td("labGrown"),
                ]
                  .filter(Boolean)
                  .join(", "),
              )
              .join("; "),
      ),
    },
    {
      label: td("facts.store"),
      raw: items.map((x) => x.product.store.slug),
      values: items.map((x) => (
        <Link
          key={x.variant.id}
          href={`/stores/${x.product.store.slug}`}
          className="link-underline"
        >
          {x.product.store.name}
        </Link>
      )),
    },
    {
      label: td("facts.city"),
      raw: items.map((x) => x.product.store.city),
      values: items.map((x) => x.product.store.city),
    },
    {
      label: td("verificationTitle"),
      raw: items.map((x) => String(isVerified(x.product.verification))),
      values: items.map((x) =>
        isVerified(x.product.verification) ? tp("verified") : td("checkStatus.PENDING"),
      ),
    },
    {
      label: t("stock"),
      raw: items.map((x) => x.variant.stockStatus),
      values: items.map((x) => tp(`stock.${x.variant.stockStatus}`)),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t("compareCount", { count: items.length, max: MAX_COMPARE })}
          {items.length === 1 && ` ${t("compareAddMore")}`}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={() => compare.clear()}>
          {t("clearAll")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("compareNote")}</p>

      <div
        className="overflow-x-auto rounded-lg border"
        tabIndex={0}
        role="region"
        aria-label={t("compareTable")}
      >
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <caption className="sr-only">{t("compareTable")}</caption>
          <thead>
            <tr>
              <td className="sticky left-0 z-10 w-32 border-b bg-card" />
              {items.map((x) => (
                <th
                  key={x.variant.id}
                  scope="col"
                  className="w-56 border-b border-l p-3 text-left align-top font-normal"
                >
                  <div className="flex flex-col gap-2">
                    <div className="relative aspect-[4/5] w-full max-w-40 overflow-hidden rounded-md bg-muted">
                      {x.product.images[0] && (
                        <Image
                          src={x.product.images[0].url}
                          alt=""
                          fill
                          sizes="10rem"
                          unoptimized={x.product.images[0].url.endsWith(".svg")}
                          className="object-cover"
                        />
                      )}
                    </div>
                    <Link
                      href={`/products/${x.product.slug}`}
                      className="line-clamp-2 link-underline font-medium"
                    >
                      {x.product.name[locale]}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {t("sku", { sku: x.variant.sku })}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="self-start"
                      onClick={() => compare.remove(x.variant.id)}
                      aria-label={t("removeItem", { name: x.product.name[locale] })}
                    >
                      <X aria-hidden />
                      {t("remove")}
                    </Button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const diff = items.length > 1 && differs(row.raw);
              return (
                <tr key={row.label} className="even:bg-muted/40">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-b bg-card p-3 text-left align-top text-xs font-semibold text-muted-foreground"
                  >
                    {row.label}
                  </th>
                  {row.values.map((v, i) => (
                    <td
                      key={items[i].variant.id}
                      className={cn("border-b border-l p-3 align-top", diff && "text-gold-text")}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
