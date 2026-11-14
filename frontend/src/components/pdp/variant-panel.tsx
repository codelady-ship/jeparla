"use client";

import { GitCompareArrows, Heart, MessageCircle } from "lucide-react";
import { useState } from "react";
import { toggleCompare, type ProductActionLabels } from "@/components/product/product-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { compare, favorites } from "@/lib/saved-list";
import { useSavedIds } from "@/lib/use-saved";
import type { ContactQuestion } from "@/lib/whatsapp";
import { cn } from "cn";
import { StoreOpenStatus, type StoreStatusLabels } from "./store-open-status";

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
};

type Labels = {
  choose: string;
  sku: string;
  priceUpdated: string;
  whatsapp: string;
  questionLegend: string;
  status: StoreStatusLabels;
  metalLinkedNote: string | null;
  actions: ProductActionLabels;
};

export function VariantPanel({
  productId,
  openingHours,
  variants,
  labels,
}: {
  productId: number;
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
  if (!v) return null;
  const contact = v.whatsapp.find((w) => w.question === question) ?? v.whatsapp[0];

  return (
    <div className="flex flex-col gap-5">
      <div data-keep-clear="">
        <p className="text-3xl font-semibold tabular-nums">{v.price}</p>
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
          onClick={() => favorites.toggle(productId)}
        >
          <Heart aria-hidden className={cn(isFavorite && "fill-current text-gold-text")} />
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
            className={cn(compared.includes(v.id) && "text-gold-text")}
          />
          {compared.includes(v.id) ? labels.actions.compareRemove : labels.actions.compareAdd}
        </Button>
      </div>
    </div>
  );
}
