import Big from "big.js";
import { Calculator, ChevronDown, ExternalLink } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { formatGrams, formatPrice } from "@/lib/money";
import { alloyGramPrice, cbarUrl } from "@/lib/pricing";
import type { ReactNode } from "react";
import type { MetalPrice, Product, Variant } from "@/types/api";

type Row = { key: string; label: string; detail?: string; value: string; strong?: boolean };

const cents = (b: Big) => b.round(2, Big.roundHalfUp).toFixed(2);

/**
 * "How the price is calculated" (#104) under the price: a native details/summary block, so it works
 * without JavaScript. METAL_LINKED parts come from the backend (`Variant.priceBreakdown`, the same
 * PricingEngine function and rounding as the price itself); nothing is recomputed here. FIXED prices
 * show only today's estimated metal value at the variant's weight, never invented labor or markup.
 * Bijouterie (#128) has no metal, so there is no block.
 */
export function PriceBreakdownBlock({
  product,
  variants,
  metalPrices,
}: {
  product: Product;
  /** Variant id -> the label the variant picker shows. */
  variants: { id: number; label: string }[];
  metalPrices: MetalPrice[];
}) {
  const t = useTranslations("Pdp.breakdown");
  const format = useFormatter();
  const locale = useLocale();
  if (product.materialKind === "FASHION" || product.metal === null) return null;
  if (product.variants.length === 0) return null;
  const today = metalPrices.find((m) => m.metal === product.metal) ?? null;
  const date = (iso: string) =>
    format.dateTime(new Date(`${iso.slice(0, 10)}T00:00:00Z`), {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  const money = (amount: string) => formatPrice(amount, locale);
  const many = product.variants.length > 1;

  const section = (v: Variant) => {
    const b = v.priceBreakdown ?? null;
    const rows: Row[] = [];
    const notes: ReactNode[] = [];
    if (b?.metal) {
      rows.push({
        key: "metal",
        label: t("metal"),
        detail: t("metalFormula", {
          weight: formatGrams(b.metal.weightGrams, locale),
          fineness: b.metal.fineness,
          gramPrice: money(b.metal.gramPrice.amount),
        }),
        value: money(b.metal.value.amount),
      });
      // Labor and the store's markup on one line by default; two lines when the store chose so (#104).
      if (b.laborSeparate) {
        if (b.labor)
          rows.push({ key: "labor", label: t("labor"), value: money(b.labor.amount.amount) });
        if (b.markup)
          rows.push({
            key: "markup",
            label: t("markup"),
            detail: t("markupPercent", { percent: new Big(b.markup.percent).toString() }),
            value: money(b.markup.amount.amount),
          });
      } else if (b.labor || b.markup) {
        const share = new Big(b.labor?.amount.amount ?? "0").plus(b.markup?.amount.amount ?? "0");
        rows.push({ key: "labor", label: t("laborAndShare"), value: money(cents(share)) });
      }
      if (b.stone) {
        rows.push({
          key: "stone",
          label: t("stone"),
          detail: t("fromSeller"),
          value: money(b.stone.amount),
        });
      }
      if (b.clamped) notes.push(t(`clamped.${b.clamped}`));
      notes.push(
        <>
          {b.metal.source === "CBAR"
            ? t("quoteCbar", { date: date(b.metal.quoteDate) })
            : t("quoteAdmin", { date: date(b.metal.quoteDate) })}{" "}
          {b.metal.source === "CBAR" && (
            <a
              href={cbarUrl(b.metal.quoteDate)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 link-underline font-medium text-foreground"
            >
              {t("cbarLink")}
              <ExternalLink aria-hidden className="size-3" />
            </a>
          )}
        </>,
      );
    } else {
      notes.push(t("fixed"));
      if (today && v.fineness && v.weightGrams) {
        const value = new Big(v.weightGrams)
          .times(v.fineness.value)
          .div(1000)
          .times(today.pricePerGram);
        rows.push({
          key: "metalToday",
          label: t("metalToday"),
          detail: t("metalTodayFormula", {
            weight: formatGrams(v.weightGrams, locale),
            fineness: v.fineness.value,
            gramPrice: money(today.pricePerGram),
            date: date(today.date),
          }),
          value: money(cents(value)),
        });
      }
    }
    // The total is always the variant price: the same value as the price above and the JSON-LD offer.
    rows.push({ key: "total", label: t("total"), value: money(v.price.amount), strong: true });

    const perGram =
      b?.pricePerGram?.amount ??
      (v.weightGrams && new Big(v.weightGrams).gt(0)
        ? new Big(v.price.amount).div(v.weightGrams).round(2, Big.roundHalfUp).toFixed(2)
        : null);
    if (perGram) rows.push({ key: "perGram", label: t("perGram"), value: money(perGram) });
    if (today && v.fineness) {
      rows.push({
        key: "gramToday",
        label: t("gramToday", { fineness: v.fineness.value }),
        value: money(alloyGramPrice(today.pricePerGram, v.fineness.value)),
      });
    }
    return { rows, notes };
  };

  return (
    <details
      data-testid="price-breakdown"
      className="group/pb rounded-md border text-sm [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 font-medium">
        <Calculator aria-hidden className="size-4 text-gold-text" />
        {t("title")}
        <ChevronDown
          aria-hidden
          className="ml-auto size-4 transition-transform group-open/pb:rotate-180"
        />
      </summary>
      <div className="flex flex-col gap-4 border-t px-3 py-3">
        {product.variants.map((v) => {
          const { rows, notes } = section(v);
          const label = variants.find((x) => x.id === v.id)?.label ?? v.sku;
          return (
            <div key={v.id} className="flex flex-col gap-2">
              {many && <p className="font-medium">{t("variant", { label })}</p>}
              <table className="w-full">
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.key}
                      className={r.strong ? "border-t font-semibold" : "text-muted-foreground"}
                    >
                      <th scope="row" className="py-1 pr-3 text-left font-normal">
                        <span className={r.strong ? "font-semibold text-foreground" : ""}>
                          {r.label}
                        </span>
                        {r.detail && <span className="block text-xs">{r.detail}</span>}
                      </th>
                      <td className="py-1 text-right align-top text-foreground tabular-nums">
                        {r.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {notes.map((n, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  {n}
                </p>
              ))}
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground">{t("note")}</p>
      </div>
    </details>
  );
}
