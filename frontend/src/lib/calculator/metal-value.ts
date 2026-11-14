import type { Decimal, Fineness, MetalType } from "@/types/api";

/**
 * Metal value calculator (#105): weight x fineness / 1000 x CBAR gram price of the pure
 * metal, rounded half up to cents. Exact fixed-point arithmetic on BigInt, so the
 * client island ships no decimal library and never touches a float. Same result as
 * metalLinkedPrice() in pricing.ts and the backend PricingEngine with a metal-only rule
 * (tested against backend/src/test/resources/pricing/pricing-cases.json).
 */

/** Largest weight the calculator accepts, in grams (10 kg). */
export const MAX_WEIGHT_GRAMS = 10_000;
/** Weight precision: milligrams, as in the catalog (NUMERIC(8,3)). */
export const WEIGHT_DECIMALS = 3;

/**
 * Finenesses used when GET /finenesses is unavailable. Mirrors the common hallmarks the
 * admin list starts with (V3 finenesses table: parts per thousand, 1..1000).
 */
export const FALLBACK_FINENESSES: Fineness[] = [
  { id: -1, metal: "GOLD", value: 375, label: "375 (9K)" },
  { id: -2, metal: "GOLD", value: 583, label: "583 (14K)" },
  { id: -3, metal: "GOLD", value: 585, label: "585 (14K)" },
  { id: -4, metal: "GOLD", value: 750, label: "750 (18K)" },
  { id: -5, metal: "GOLD", value: 916, label: "916 (22K)" },
  { id: -6, metal: "GOLD", value: 999, label: "999 (24K)" },
  { id: -7, metal: "SILVER", value: 875, label: "875" },
  { id: -8, metal: "SILVER", value: 925, label: "925" },
  { id: -9, metal: "SILVER", value: 999, label: "999" },
];

export type WeightError = "empty" | "format" | "notPositive" | "tooPrecise" | "tooLarge";
export type WeightResult = { ok: true; value: Decimal } | { ok: false; error: WeightError };

/**
 * Reads a weight typed by a person: "4,2", "4.2", " 4.250 ", ",5". One decimal separator,
 * comma or dot; no thousands separators, no exponent. Returns a canonical decimal string
 * ("4.25" -> "4.25", "004,500" -> "4.5").
 */
export function parseWeight(raw: string | null | undefined): WeightResult {
  const s = (raw ?? "").trim().replace(/\s+/g, "");
  if (s === "") return { ok: false, error: "empty" };
  const m = /^([+-]?)(\d*)(?:[.,](\d*))?$/.exec(s);
  if (!m || (m[2] === "" && (m[3] ?? "") === "")) return { ok: false, error: "format" };
  const [, sign, intRaw, fracRaw = ""] = m;
  const int = intRaw.replace(/^0+(?=\d)/, "") || "0";
  const frac = fracRaw.replace(/0+$/, "");
  const zero = /^0+$/.test(int + (frac || "0"));
  if (sign === "-" || zero) return { ok: false, error: "notPositive" };
  if (frac.length > WEIGHT_DECIMALS) return { ok: false, error: "tooPrecise" };
  const value = frac ? `${int}.${frac}` : int;
  if (compareDecimal(value, String(MAX_WEIGHT_GRAMS)) > 0) return { ok: false, error: "tooLarge" };
  return { ok: true, value };
}

// ------------------------------------------------------------------ fixed point

type Fixed = { n: bigint; scale: number };

const pow10 = (k: number) => BigInt(`1${"0".repeat(k)}`);

/** "123.4500" -> { n: 1234500n, scale: 4 }. Throws on anything that is not a plain decimal. */
function toFixed(d: Decimal): Fixed {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(d.trim());
  if (!m) throw new Error(`not a decimal: ${d}`);
  const [, sign, int, frac = ""] = m;
  const n = BigInt(int + frac);
  return { n: sign ? -n : n, scale: frac.length };
}

/** Rounds n / 10^scale half up (away from zero) to `digits` places, as a decimal string. */
function roundHalfUp({ n, scale }: Fixed, digits: number): Decimal {
  let q: bigint;
  if (scale <= digits) {
    q = n * pow10(digits - scale);
  } else {
    const div = pow10(scale - digits);
    const neg = n < BigInt(0);
    const abs = neg ? -n : n;
    q = (abs * BigInt(2) + div) / (div * BigInt(2));
    if (neg) q = -q;
  }
  const neg = q < BigInt(0);
  const s = (neg ? -q : q).toString().padStart(digits + 1, "0");
  const out = digits ? `${s.slice(0, -digits)}.${s.slice(-digits)}` : s;
  return neg && q !== BigInt(0) ? `-${out}` : out;
}

function compareDecimal(a: Decimal, b: Decimal): number {
  const x = toFixed(a);
  const y = toFixed(b);
  const s = Math.max(x.scale, y.scale);
  const l = x.n * pow10(s - x.scale);
  const r = y.n * pow10(s - y.scale);
  return l === r ? 0 : l < r ? -1 : 1;
}

/** weight x fineness / 1000 x pure gram price, rounded half up to 0.01. */
export function metalValue(
  weightGrams: Decimal,
  fineness: number,
  pureGramPrice: Decimal,
): Decimal {
  if (!Number.isInteger(fineness) || fineness <= 0 || fineness > 1000) {
    throw new Error(`fineness must be 1..1000, got ${fineness}`);
  }
  const w = toFixed(weightGrams);
  const p = toFixed(pureGramPrice);
  return roundHalfUp({ n: w.n * BigInt(fineness) * p.n, scale: w.scale + p.scale + 3 }, 2);
}

/** Gram price of the alloy: pure gram price x fineness / 1000, to cents (alloyGramPrice). */
export function alloyGramPrice(pureGramPrice: Decimal, fineness: number): Decimal {
  return metalValue("1", fineness, pureGramPrice);
}

// ------------------------------------------------------------------ options and URL

export type MetalOption = {
  metal: MetalType;
  /** CBAR gram price of the pure metal, AZN, 4 decimals. */
  pureGramPrice: Decimal;
  pricePerOunce: Decimal;
  /** Business date of the CBAR quote (weekends keep the last one). */
  date: string;
  finenesses: { value: number; label: string }[];
};

const METAL_ORDER: MetalType[] = ["GOLD", "SILVER", "PLATINUM", "PALLADIUM"];

/** Metals that have both a price today and at least one fineness, in a fixed order. */
export function buildOptions(
  prices: { metal: MetalType; pricePerGram: Decimal; pricePerOunce: Decimal; date: string }[],
  finenesses: Fineness[],
): MetalOption[] {
  return METAL_ORDER.flatMap((metal) => {
    const price = prices.find((p) => p.metal === metal);
    const list = finenesses
      .filter((f) => f.metal === metal && f.value > 0 && f.value <= 1000)
      .map((f) => ({ value: f.value, label: f.label }));
    if (!price || list.length === 0 || !(compareDecimal(price.pricePerGram, "0") > 0)) return [];
    return [
      {
        metal,
        pureGramPrice: price.pricePerGram,
        pricePerOunce: price.pricePerOunce,
        date: price.date,
        finenesses: list,
      },
    ];
  });
}

export type Selection = { metal: MetalType; fineness: number; weight: string };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Selection from `?metal=gold&fineness=585&weight=4.2`. Unknown metals or finenesses
 * fall back to gold 585 (or the first option); the weight stays as typed, so the form
 * can show it next to its error.
 */
export function selectionFromParams(
  sp: Record<string, string | string[] | undefined>,
  options: MetalOption[],
): Selection | null {
  if (options.length === 0) return null;
  const metalParam = (first(sp.metal) ?? "").toUpperCase();
  const option =
    options.find((o) => o.metal === metalParam) ??
    options.find((o) => o.metal === "GOLD") ??
    options[0];
  const wanted = Number(first(sp.fineness));
  const fineness =
    option.finenesses.find((f) => f.value === wanted)?.value ??
    option.finenesses.find((f) => f.value === 585)?.value ??
    option.finenesses[0].value;
  return { metal: option.metal, fineness, weight: (first(sp.weight) ?? "").slice(0, 32) };
}

/** Query string for a shareable link; the weight is stored with a dot. */
export function toQuery(s: Selection): string {
  const sp = new URLSearchParams({ metal: s.metal.toLowerCase(), fineness: String(s.fineness) });
  const w = parseWeight(s.weight);
  if (w.ok) sp.set("weight", w.value);
  else if (s.weight.trim()) sp.set("weight", s.weight.trim());
  return `?${sp.toString()}`;
}
