import { CircleAlert } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { api, USING_MOCK } from "@/lib/api";
import {
  alloyGramPrice,
  buildOptions,
  FALLBACK_FINENESSES,
  selectionFromParams,
  type MetalOption,
} from "@/lib/calculator/metal-value";
import { formatPrice } from "@/lib/money";
import type { Fineness, MetalPrice, MetalType } from "@/types/api";
import { CalculatorForm, type CalculatorLabels, type ComboText } from "./calculator-form";

type SearchParams = Record<string, string | string[] | undefined>;

async function load(): Promise<{ prices: MetalPrice[]; finenesses: Fineness[] } | null> {
  try {
    const [prices, finenesses] = await Promise.all([
      api.latestMetalPrices(),
      // The admin fineness list (GET /finenesses); the typed list only if it is down.
      api.listFinenesses().catch(() => FALLBACK_FINENESSES),
    ]);
    return { prices, finenesses: finenesses.length ? finenesses : FALLBACK_FINENESSES };
  } catch {
    return null;
  }
}

/**
 * The calculator with today's CBAR prices (#105). Server rendered from the URL
 * (`?metal=gold&fineness=585&weight=4.2`), so a shared link shows its result without
 * JavaScript; the form is a small client island that recalculates as you type.
 */
export async function MetalCalculator({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [t, tm, tp, locale, sp, data] = await Promise.all([
    getTranslations("Calculator"),
    getTranslations("MetalPrices"),
    getTranslations("Product"),
    getLocale() as Promise<Locale>,
    searchParams,
    load(),
  ]);

  const notice = (text: string) => (
    <p
      role="status"
      className="flex items-start gap-2 rounded-lg border bg-card p-5 text-sm text-muted-foreground"
    >
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      {text}
    </p>
  );

  if (!data) return notice(t("unavailable"));
  const options: MetalOption[] = buildOptions(data.prices, data.finenesses);
  const initial = selectionFromParams(sp, options);
  if (!initial) return notice(t("noPrices"));

  const metalName = (m: MetalType) => tp(`metal.${m}`);
  const money = (v: string) => formatPrice(v, locale);
  // Every sentence that depends only on the metal and fineness, written here so the
  // island needs no message formatter.
  const combos: Record<string, ComboText> = {};
  const pure: Record<string, string> = {};
  for (const o of options) {
    const metal = metalName(o.metal);
    pure[o.metal] = t("purePrice", {
      metal,
      gram: money(o.pureGramPrice),
      ounce: money(o.pricePerOunce),
    });
    for (const f of o.finenesses) {
      combos[`${o.metal}-${f.value}`] = {
        gram: t("gramPrice", {
          metal,
          fineness: f.value,
          price: money(alloyGramPrice(o.pureGramPrice, f.value)),
        }),
        products: t("products", { metal, fineness: f.value }),
      };
    }
  }

  const labels: CalculatorLabels = {
    form: t("formLabel"),
    weight: t("weight"),
    weightHint: t("weightHint"),
    metal: t("metal"),
    fineness: t("fineness"),
    submit: t("submit"),
    result: t("resultLabel"),
    prompt: t("prompt"),
    summary: t.raw("resultSummary") as string,
    source: tm("source"),
    weekend: t("weekendNote"),
    notShopPrice: t("notShopPrice"),
    errors: {
      empty: t("errors.empty"),
      format: t("errors.format"),
      notPositive: t("errors.notPositive"),
      tooPrecise: t("errors.tooPrecise"),
      tooLarge: t("errors.tooLarge"),
    },
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Honesty rule: invented demo prices are labelled as such. */}
      {USING_MOCK && (
        <Badge variant="secondary" className="self-start">
          {tm("demoData")}
        </Badge>
      )}
      <CalculatorForm
        locale={locale}
        options={options}
        initial={initial}
        metalNames={Object.fromEntries(options.map((o) => [o.metal, metalName(o.metal)]))}
        combos={combos}
        pure={pure}
        labels={labels}
      />
    </div>
  );
}

export function MetalCalculatorSkeleton({ label }: { label: string }) {
  return (
    <div
      aria-busy="true"
      aria-label={label}
      className="grid gap-6 rounded-lg border p-5 sm:p-6 lg:grid-cols-2"
    >
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <Skeleton className="h-56" />
    </div>
  );
}
