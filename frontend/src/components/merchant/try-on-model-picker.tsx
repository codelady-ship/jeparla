"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { AiModel, ModelAudience } from "@/types/ai";
import type { ProductAudience } from "@/types/merchant";

/**
 * Whether a model of the library may wear a piece (#121), as the backend AudienceRules.fits:
 * a kids piece only on a child model and a child model only with a kids piece; a unisex
 * piece on any adult model.
 */
export function modelFits(product: ProductAudience, model: ModelAudience): boolean {
  if (product === "KIDS" || model === "KIDS") return product === model;
  return product === "UNISEX" || product === model;
}

/**
 * "Show on a model" at upload (#315): the seller picks one AI model of the library, or none.
 * With a pick, saving the product queues an on-model image of the first photo with that model;
 * it is published only after the seller approves it in AI Studio. Only models that fit the
 * product's audience are offered; a pick that stops fitting counts as none.
 */
export function TryOnModelPicker({
  models,
  audience,
  value,
  onChange,
}: {
  models: AiModel[];
  audience: ProductAudience;
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const t = useTranslations("Merchant.form.tryOn");
  const offered = models.filter((m) => modelFits(audience, m.audience));
  if (offered.length === 0) return null;
  const picked = offered.some((m) => m.id === value) ? value : null;

  const option = (id: number | null, body: ReactNode, key: string) => (
    <label
      key={key}
      className="flex cursor-pointer flex-col gap-1 rounded-lg border p-1.5 has-checked:border-gold has-checked:ring-2 has-checked:ring-gold/40 has-focus-visible:ring-2 has-focus-visible:ring-ring"
    >
      <input
        type="radio"
        name="try-on-model"
        value={id ?? ""}
        checked={picked === id}
        onChange={() => onChange(id)}
        className="sr-only"
      />
      {body}
    </label>
  );

  return (
    <fieldset className="flex flex-col gap-2" aria-describedby="try-on-hint">
      <legend className="mb-1 font-semibold">{t("legend")}</legend>
      <p id="try-on-hint" className="text-sm text-muted-foreground">
        {t("hint")}
      </p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {option(
          null,
          <span className="flex aspect-[4/5] items-center justify-center rounded-md bg-muted p-2 text-center text-sm">
            {t("none")}
          </span>,
          "none",
        )}
        {offered.map((model) =>
          option(
            model.id,
            <>
              <span className="relative aspect-[4/5] overflow-hidden rounded-md bg-muted">
                {model.images[0] && (
                  <Image
                    src={model.images[0].url}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 20vw, 33vw"
                    className="object-cover"
                    unoptimized
                  />
                )}
              </span>
              <span className="px-1 text-sm font-medium">{model.name}</span>
            </>,
            String(model.id),
          ),
        )}
      </div>
    </fieldset>
  );
}
