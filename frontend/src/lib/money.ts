import type { Decimal } from "@/types/api";

/**
 * Exact, locale-aware display of decimal strings (BigDecimal from the API).
 *
 * Not Intl: browsers ship partial locale data. Chrome has no Azerbaijani number
 * format, so client-rendered prices came out as "AZN 508.75" while the server
 * wrote "508,75 ₼". These rules match Node's full ICU output (CLDR), so server and
 * client render the same text, and the string never becomes a float.
 */
type Locale = "az" | "en" | "ru";

const NBSP = " ";
const SEP: Record<Locale, { group: string; decimal: string }> = {
  az: { group: ".", decimal: "," },
  en: { group: ",", decimal: "." },
  ru: { group: NBSP, decimal: "," },
};
const GRAM: Record<Locale, string> = { az: "q", en: "g", ru: "г" };

function split(value: Decimal) {
  const v = value.trim();
  const negative = v.startsWith("-");
  const [int = "0", frac = ""] = v.replace(/^[-+]/, "").split(".");
  return { negative, int: int.replace(/^0+(?=\d)/, "") || "0", frac };
}

/** Rounds half-up at `digits`, working on the digit string. */
function round(int: string, frac: string, digits: number) {
  if (frac.length <= digits) return { int, frac };
  const keep = int + frac.slice(0, digits);
  const up = Number(frac[digits]) >= 5;
  let digitsOut = keep;
  if (up) {
    const arr = keep.split("").map(Number);
    let i = arr.length - 1;
    while (i >= 0) {
      if (arr[i] === 9) {
        arr[i] = 0;
        i--;
      } else {
        arr[i]++;
        break;
      }
    }
    digitsOut = (i < 0 ? "1" : "") + arr.join("");
  }
  const cut = digitsOut.length - digits;
  return { int: digitsOut.slice(0, cut) || "0", frac: digitsOut.slice(cut) };
}

export function formatDecimal(
  value: Decimal,
  locale: string,
  { min = 0, max = 3 }: { min?: number; max?: number } = {},
): string {
  const l = (locale in SEP ? locale : "en") as Locale;
  const p = split(value);
  const r = round(p.int, p.frac, max);
  let frac = r.frac.replace(/0+$/, "");
  if (frac.length < min) frac = frac.padEnd(min, "0");
  const int = r.int.replace(/\B(?=(\d{3})+(?!\d))/g, SEP[l].group);
  const isZero = /^0*$/.test(r.int + r.frac);
  return `${p.negative && !isZero ? "-" : ""}${int}${frac ? SEP[l].decimal + frac : ""}`;
}

/** "1.508,75 ₼" (az), "AZN 1,508.75" (en), "1 508,75 AZN" (ru). */
export function formatPrice(amount: Decimal, locale: string): string {
  const n = formatDecimal(amount.replace(/^-/, ""), locale, { min: 2, max: 2 });
  const sign = amount.trim().startsWith("-") ? "-" : "";
  if (locale === "az") return `${sign}${n}${NBSP}₼`;
  if (locale === "ru") return `${sign}${n}${NBSP}AZN`;
  return `${sign}AZN${NBSP}${n}`;
}

/** "1,2 q" (az), "1.2 g" (en), "1,2 г" (ru), up to 3 decimals. */
export function formatGrams(grams: Decimal, locale: string): string {
  const l = (locale in GRAM ? locale : "en") as Locale;
  // CLDR uses a plain space before unit symbols (unlike currencies).
  return `${formatDecimal(grams, l, { max: 3 })} ${GRAM[l]}`;
}
