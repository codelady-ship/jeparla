"use client";

import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

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
  whatsappHref: string;
};

type Labels = {
  choose: string;
  sku: string;
  priceUpdated: string;
  whatsapp: string;
  metalLinkedNote: string | null;
};

export function VariantPanel({ variants, labels }: { variants: VariantView[]; labels: Labels }) {
  const [id, setId] = useState(variants[0]?.id);
  const v = variants.find((x) => x.id === id) ?? variants[0];
  if (!v) return null;

  return (
    <div className="flex flex-col gap-5">
      <div>
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

      <a
        href={v.whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ variant: "gold", size: "lg" }), "h-12 w-full text-base")}
      >
        <MessageCircle aria-hidden />
        {labels.whatsapp}
      </a>
    </div>
  );
}
