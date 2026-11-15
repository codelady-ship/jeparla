"use client";

import { GitCompareArrows, Heart, MessageCircle } from "lucide-react";
import { useState } from "react";
import { toggleCompare, type ProductActionLabels } from "@/components/product/product-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { sendContactClick } from "@/lib/contact-click";
import { compare, favorites } from "@/lib/saved-list";
import { toggleFavorite } from "@/lib/saved-prices";
import { useDisplayCurrency } from "@/lib/use-display-currency";
import { useSavedIds } from "@/lib/use-saved";
import type { ContactQuestion } from "@/lib/whatsapp";
import { cn } from "cn";
import { StoreOpenStatus, type StoreStatusLabels } from "./store-open-status";
import type { DisplayCurrency, Money } from "@/types/api";

/** Everything about a variant the client needs, already formatted on the server. */
export type VariantView = {
  id: number;
  label: string;
  price: string;
  sku: string;
  stock: string;
  inStock: boolean;
  /** ISO date-time for <time dateTime>. */
  updatedIso: string;
  updated: string;
  /** One prefilled WhatsApp link per ready question (#111). */
  whatsapp: { question: ContactQuestion; label: string; href: string }[];
  /** Approximate price in USD/EUR at the CBAR rate (#53), already formatted; empty without rates. */
  approx: Partial<Record<DisplayCurrency, string>>;
};

type Labels = {
  choose: string;
  sku: string;
  priceUpdated: string;
  whatsapp: string;
  questionLegend: string;
  status: StoreStatusLabels;
  metalLinkedNote: string | null;
  /** Currency switch (#53); null when no rate is available. */
  currency: { label: string; note: string } | null;
  actions: ProductActionLabels;
};

export function VariantPanel({
  productId,
  priceFrom,
  openingHours,
  variants,
  labels,
}: {
  productId: number;
  /** The product "from" price, remembered when it is added to favourites (#112). */
  priceFrom: Money;
  /** schema.org openingHours of the store; null when the store is unknown. */
  openingHours: string | null;
  variants: VariantView[];
  labels: Labels;
}) {
  const [id, setId] = useState(variants[0]?.id);
  const [question, setQuestion] = useState<ContactQuestion>("GENERAL");
  const v = variants.find((x) => x.id === id) ?? variants[0];
  const isFavorite = useSavedIds(favorites).includes(productId);
  const compared = useSavedIds(compare);
  // AZN is the price; USD/EUR is an extra approximate line, remembered per browser.
  const [currency, choose] = useDisplayCurrency();
  if (!v) return null;
  const contact = v.whatsapp.find((w) => w.question === question) ?? v.whatsapp[0];
  const approx = currency === "AZN" ? undefined : v.approx[currency];
  const options = (["AZN", "USD", "EUR"] as const).filter((c) => c === "AZN" || v.approx[c]);

  return (
    <div className="flex flex-col gap-5">
      <div data-keep-clear="">
        <p className="text-3xl font-semibold tabular-nums">{v.price}</p>
        {labels.currency && options.length > 1 && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label={labels.currency.label}
              className="inline-flex rounded-md border"
            >
              {options.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={currency === c}
                  onClick={() => choose(c)}
                  className={cn(
                    "min-w-11 px-2.5 py-1 text-xs font-medium first:rounded-l-md last:rounded-r-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none pointer-coarse:min-h-11",
                    currency === c ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            {approx && (
              <p className="text-sm tabular-nums" aria-live="polite">
                {approx} <span className="text-muted-foreground">({labels.currency.note})</span>
              </p>
            )}
          </div>
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          {labels.priceUpdated} <time dateTime={v.updatedIso}>{v.updated}</time>
        </p>
        {labels.metalLinkedNote && (
          <p className="mt-1 text-sm text-muted-foreground">{labels.metalLinkedNote}</p>
        )}
      </div>

      {variants.length > 1 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">{labels.choose}</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((x) => (
              <label
                key={x.id}
                className={cn(
                  "cursor-pointer rounded-md border px-3 py-2 text-sm has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                  x.id === v.id && "border-primary bg-primary text-primary-foreground",
                )}
              >
                <input
                  type="radio"
                  name="variant"
                  value={x.id}
                  checked={x.id === v.id}
                  onChange={() => setId(x.id)}
                  className="sr-only"
                />
                {x.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <p className="text-sm">
        <span className={v.inStock ? "text-success" : "text-muted-foreground"}>{v.stock}</span>
        <span className="text-muted-foreground">
          {" · "}
          {labels.sku} {v.sku}
        </span>
      </p>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">{labels.questionLegend}</legend>
        <div className="flex flex-wrap gap-2">
          {v.whatsapp.map((w) => (
            <label
              key={w.question}
              className={cn(
                "inline-flex min-h-8 cursor-pointer items-center rounded-full border px-3 text-sm has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50 pointer-coarse:min-h-11",
                w.question === contact?.question &&
                  "border-primary bg-primary text-primary-foreground",
              )}
            >
              <input
                type="radio"
                name="contact-question"
                value={w.question}
                checked={w.question === contact?.question}
                onChange={() => setQuestion(w.question)}
                className="sr-only"
              />
              {w.label}
            </label>
          ))}
        </div>
      </fieldset>

      <a
        href={contact?.href ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        data-keep-clear=""
        onClick={() => {
          if (contact) sendContactClick({ productId, question: contact.question });
        }}
        className={cn(buttonVariants({ variant: "gold", size: "lg" }), "h-12 w-full text-base")}
      >
        <MessageCircle aria-hidden />
        {labels.whatsapp}
      </a>
      {openingHours && (
        <StoreOpenStatus openingHours={openingHours} labels={labels.status} className="-mt-3" />
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          className="pointer-coarse:h-11"
          aria-pressed={isFavorite}
          onClick={() => toggleFavorite(productId, priceFrom)}
        >
          <Heart
            aria-hidden
            className={cn("press-icon", isFavorite && "fill-current text-gold-text")}
          />
          {isFavorite ? labels.actions.favoriteRemove : labels.actions.favoriteAdd}
        </Button>
        {/* Compare is per variant: switching the variant above changes what is added. */}
        <Button
          type="button"
          variant="outline"
          className="pointer-coarse:h-11"
          aria-pressed={compared.includes(v.id)}
          onClick={() => toggleCompare(v.id, labels.actions)}
        >
          <GitCompareArrows
            aria-hidden
            className={cn("press-icon", compared.includes(v.id) && "text-gold-text")}
          />
          {compared.includes(v.id) ? labels.actions.compareRemove : labels.actions.compareAdd}
        </Button>
      </div>
    </div>
  );
}
