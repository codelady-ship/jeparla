"use client";

import { useLocale, useTranslations } from "next-intl";
import { RadioGroupField, TextField } from "@/components/sell/fields";
import { formatPrice } from "@/lib/money";
import { metalLinkedBreakdown, type PriceBreakdown } from "@/lib/pricing";
import type { Decimal, PricingMode } from "@/types/api";
import type { PricingInput, VariantInput } from "@/types/merchant";

/** Current pure-metal price for the chosen metal (CBAR, PLAN 5.10). */
export type GramQuote = { pricePerGram: Decimal; date: string };

const MONEY = /^\d{1,8}(\.\d{1,2})?$/;
const WEIGHT = /^\d{1,8}(\.\d{1,3})?$/;
const norm = (v: string) => v.trim().replace(",", ".");

/** Exact preview with the same formula as the backend; null until inputs are valid. */
export function previewPrice(
  variant: Pick<VariantInput, "weightGrams">,
  fineness: number | null,
  quote: GramQuote | null,
  pricing: PricingInput,
): PriceBreakdown | null {
  const weight = norm(variant.weightGrams);
  if (!quote || !fineness || !WEIGHT.test(weight) || Number(weight) <= 0) return null;
  const amount = (v: string) => (norm(v) === "" ? "0" : norm(v));
  const values = {
    laborPerGram: amount(pricing.laborPerGram),
    laborFixed: amount(pricing.laborFixed),
    stonePrice: amount(pricing.stonePrice),
    markupPercent: amount(pricing.markupPercent),
  };
  if (!Object.values(values).every((v) => MONEY.test(v))) return null;
  const limit = (v: string) => (norm(v) === "" ? null : MONEY.test(norm(v)) ? norm(v) : undefined);
  const minPrice = limit(pricing.minPrice);
  const maxPrice = limit(pricing.maxPrice);
  if (minPrice === undefined || maxPrice === undefined) return null;
  return metalLinkedBreakdown({
    weightGrams: weight,
    fineness,
    pureGramPrice: quote.pricePerGram,
    rule: { ...values, minPrice, maxPrice },
  });
}

/**
 * Pricing mode for the whole product (PLAN 5.10): a fixed price per variant, or
 * a price linked to the daily metal rate with labor, stone, markup and limits.
 * The preview uses decimal arithmetic, so it shows what the backend will store.
 */
export function PricingFields({
  mode,
  pricing,
  variants,
  fineness,
  quote,
  errors,
  err,
  onMode,
  onPricing,
}: {
  mode: PricingMode;
  pricing: PricingInput;
  variants: VariantInput[];
  fineness: number | null;
  quote: GramQuote | null;
  errors: Record<string, string>;
  err: (key: string | undefined) => string | undefined;
  onMode: (mode: PricingMode) => void;
  onPricing: (patch: Partial<PricingInput>) => void;
}) {
  const t = useTranslations("Merchant.form.pricing");
  const locale = useLocale();
  const money = (v: Decimal) => formatPrice(v, locale);
  const first = variants[0];
  const breakdown = first ? previewPrice(first, fineness, quote, pricing) : null;

  const field = (key: keyof PricingInput, opts: { optional?: boolean; hint?: string } = {}) => (
    <TextField
      id={`pr-${key}`}
      label={t(`fields.${key}`)}
      optional={opts.optional ? t("optional") : undefined}
      hint={opts.hint}
      inputMode="decimal"
      placeholder={opts.optional ? "" : "0"}
      value={pricing[key]}
      onChange={(e) => onPricing({ [key]: e.target.value })}
      error={err(errors[`pricing.${key}`])}
    />
  );

  return (
    <div className="flex flex-col gap-5">
      <RadioGroupField
        id="pricing-mode"
        label={t("mode")}
        value={mode}
        onChange={(v) => onMode(v as PricingMode)}
        options={(["FIXED", "METAL_LINKED"] as const).map((m) => ({
          value: m,
          label: t(`modes.${m}.title`),
          hint: t(`modes.${m}.text`),
        }))}
      />

      {mode === "METAL_LINKED" && (
        <div className="flex flex-col gap-5 rounded-lg border p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {field("laborPerGram")}
            {field("laborFixed")}
            {field("stonePrice")}
            {field("markupPercent", { hint: t("hints.markupPercent") })}
            {field("minPrice", { optional: true })}
            {field("maxPrice", { optional: true })}
          </div>

          <section aria-labelledby="pricing-preview" className="flex flex-col gap-3">
            <h3 id="pricing-preview" className="font-sans text-base font-semibold">
              {t("preview.title")}
            </h3>
            {!quote ? (
              <p className="text-sm text-muted-foreground">{t("preview.noQuote")}</p>
            ) : !breakdown ? (
              <p className="text-sm text-muted-foreground">{t("preview.incomplete")}</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  {t("preview.basis", {
                    price: money(quote.pricePerGram),
                    date: quote.date.split("-").reverse().join("."),
                  })}
                </p>
                <table className="w-full max-w-md text-sm">
                  <caption className="sr-only">{t("preview.caption")}</caption>
                  <tbody>
                    {(["metal", "labor", "stone", "markup"] as const).map((k) => (
                      <tr key={k} className="border-b">
                        <th scope="row" className="py-1.5 pr-4 text-left font-normal">
                          {t(`preview.${k}`)}
                        </th>
                        <td className="py-1.5 text-right tabular-nums">{money(breakdown[k])}</td>
                      </tr>
                    ))}
                    <tr>
                      <th scope="row" className="py-2 pr-4 text-left font-semibold">
                        {t("preview.total", { n: 1 })}
                      </th>
                      <td className="py-2 text-right font-semibold tabular-nums">
                        {money(breakdown.total)}
                      </td>
                    </tr>
                  </tbody>
                </table>
                {breakdown.clamped && (
                  <p className="text-xs text-muted-foreground">
                    {t(`preview.clamped.${breakdown.clamped}`)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">{t("preview.note")}</p>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
