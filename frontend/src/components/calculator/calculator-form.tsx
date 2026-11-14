"use client";

import { ArrowRight, Info } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import {
  metalValue,
  parseWeight,
  toQuery,
  type MetalOption,
  type Selection,
  type WeightError,
} from "@/lib/calculator/metal-value";
import { formatGrams, formatPrice } from "@/lib/money";

export type ComboText = { gram: string; products: string };
export type CalculatorLabels = {
  form: string;
  weight: string;
  weightHint: string;
  metal: string;
  fineness: string;
  submit: string;
  result: string;
  prompt: string;
  /** "{weight}, {metal} {fineness}" */
  summary: string;
  source: string;
  weekend: string;
  notShopPrice: string;
  errors: Record<WeightError, string>;
};

const day = (iso: string) => iso.slice(0, 10).split("-").reverse().join(".");
const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);

const field =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Calculator form (#105). Server rendered with the result for the URL, so it works
 * without JavaScript as a GET form; with JavaScript it recalculates as you type and
 * keeps the URL shareable. All text comes ready from the server.
 */
export function CalculatorForm({
  locale,
  options,
  initial,
  metalNames,
  combos,
  pure,
  labels,
}: {
  locale: string;
  options: MetalOption[];
  initial: Selection;
  metalNames: Record<string, string>;
  combos: Record<string, ComboText>;
  pure: Record<string, string>;
  labels: CalculatorLabels;
}) {
  const [sel, setSel] = useState<Selection>(initial);
  const option = options.find((o) => o.metal === sel.metal) ?? options[0];
  const parsed = parseWeight(sel.weight);
  const showError = !parsed.ok && sel.weight.trim() !== "";
  const value = parsed.ok ? metalValue(parsed.value, sel.fineness, option.pureGramPrice) : null;
  const combo = combos[`${sel.metal}-${sel.fineness}`];

  function update(next: Selection) {
    setSel(next);
    // Shareable link without a navigation or a server round trip.
    window.history.replaceState(window.history.state, "", toQuery(next));
  }

  function pickMetal(metal: string) {
    const o = options.find((x) => x.metal === metal);
    if (!o) return;
    const keep = o.finenesses.find((f) => f.value === sel.fineness);
    const fineness = (keep ?? o.finenesses.find((f) => f.value === 585) ?? o.finenesses[0]).value;
    update({ ...sel, metal: o.metal, fineness });
  }

  return (
    <div className="grid overflow-hidden rounded-lg border bg-card lg:grid-cols-2">
      <form
        action={`/${locale}/calculator`}
        method="get"
        aria-label={labels.form}
        onSubmit={(e) => e.preventDefault()}
        className="flex flex-col gap-6 p-5 sm:p-6"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="calc-weight">{labels.weight}</Label>
          <Input
            id="calc-weight"
            name="weight"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="done"
            maxLength={32}
            value={sel.weight}
            onChange={(e) => update({ ...sel, weight: e.target.value })}
            aria-invalid={showError || undefined}
            aria-describedby={showError ? "calc-weight-hint calc-weight-error" : "calc-weight-hint"}
            className="h-11 px-3 text-base tabular-nums md:text-base"
          />
          <p id="calc-weight-hint" className="text-sm text-muted-foreground">
            {labels.weightHint}
          </p>
          <p id="calc-weight-error" aria-live="polite" className="text-sm text-destructive">
            {showError && !parsed.ok ? labels.errors[parsed.error] : ""}
          </p>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">{labels.metal}</legend>
          <div className="flex flex-wrap gap-2">
            {options.map((o) => (
              <label
                key={o.metal}
                className="flex h-11 cursor-pointer items-center rounded-lg border px-4 text-sm font-medium transition-colors hover:bg-muted has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
              >
                <input
                  type="radio"
                  name="metal"
                  value={o.metal.toLowerCase()}
                  checked={sel.metal === o.metal}
                  onChange={() => pickMetal(o.metal)}
                  className="sr-only"
                />
                {metalNames[o.metal]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label htmlFor="calc-fineness">{labels.fineness}</Label>
          <select
            id="calc-fineness"
            name="fineness"
            value={sel.fineness}
            onChange={(e) => update({ ...sel, fineness: Number(e.target.value) })}
            className={field}
          >
            {option.finenesses.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <noscript>
          <Button type="submit" size="lg" className="h-11 px-5">
            {labels.submit}
          </Button>
        </noscript>
      </form>

      <div className="flex flex-col gap-4 border-t bg-surface p-5 sm:p-6 lg:border-t-0 lg:border-l">
        <div role="status" aria-live="polite" aria-atomic="true" className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">{labels.result}</p>
          {value ? (
            <>
              <p
                data-testid="calc-value"
                className="font-heading text-4xl font-semibold tabular-nums sm:text-5xl"
              >
                {formatPrice(value, locale)}
              </p>
              <p className="text-sm text-muted-foreground tabular-nums">
                {fill(labels.summary, {
                  weight: parsed.ok ? formatGrams(parsed.value, locale) : "",
                  metal: metalNames[sel.metal],
                  fineness: String(sel.fineness),
                })}
              </p>
            </>
          ) : (
            <p className="text-base">{labels.prompt}</p>
          )}
        </div>

        <ul className="flex flex-col gap-1 text-sm tabular-nums">
          {combo && <li>{combo.gram}</li>}
          <li className="text-muted-foreground">{pure[sel.metal]}</li>
          <li className="text-muted-foreground">
            {labels.source} <time dateTime={option.date}>{day(option.date)}</time>
          </li>
          <li className="text-muted-foreground">{labels.weekend}</li>
        </ul>

        <p className="flex items-start gap-2 rounded-md border bg-card p-3 text-sm">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-text" />
          {labels.notShopPrice}
        </p>

        {combo && (
          <Link
            href={`/products?metal=${sel.metal}&fineness=${sel.fineness}`}
            prefetch={false}
            className="inline-flex items-center gap-1.5 self-start link-underline text-sm font-medium pointer-coarse:py-3"
          >
            {combo.products}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
