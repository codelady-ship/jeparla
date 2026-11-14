/**
 * Ring size arithmetic for the size guide (#114), shared by the server table and the
 * client helper. Everything is exact: lengths are integers of 0.01 mm (bigint) and π is
 * a 30-digit rational, so a displayed value never carries floating point drift. Every
 * rounding is half-up, done once on the exact value (no rounding of a rounded number).
 *
 * Size systems:
 * - Azerbaijan and the CIS number a ring by its inner diameter in mm, in steps of 0.5
 *   (a trade convention: size 17 = 17 mm inside).
 * - ISO 8653:2016 designates a ring size by its inner circumference in mm (used in most
 *   of Europe). Circumference = π × diameter, so this conversion is plain geometry.
 * - US sizes are not converted: we found no current published standard to cite.
 */

/** π to 30 decimal places, as numerator / denominator. */
const PI_NUM = BigInt("3141592653589793238462643383279");
const PI_DEN = BigInt(`1${"0".repeat(30)}`);

/** Sizes in the table: 15 to 24 in half steps (diameter 15.0 to 24.0 mm). */
export const MIN_SIZE_HALVES = BigInt(30);
export const MAX_SIZE_HALVES = BigInt(48);

/** Exact a / b rounded half-up to an integer (a >= 0, b > 0). */
function roundDiv(a: bigint, b: bigint): bigint {
  return (BigInt(2) * a + b) / (BigInt(2) * b);
}

/**
 * Parses a length in mm typed by a person ("17", "17.25", "53,5"). Accepts a dot or a
 * comma and at most two decimals. Returns hundredths of a mm, or null when not a length.
 */
export function parseMm(input: string): bigint | null {
  const m = /^\s*(\d{1,3})(?:[.,](\d{1,2}))?\s*$/.exec(input);
  if (!m) return null;
  const value = BigInt(m[1]) * BigInt(100) + BigInt((m[2] ?? "").padEnd(2, "0"));
  return value > BigInt(0) ? value : null;
}

export type RingMeasure = {
  /** Inner diameter in tenths of a mm, rounded half-up. */
  diameterTenths: bigint;
  /** Inner circumference in tenths of a mm, rounded half-up. */
  circumferenceTenths: bigint;
  /** Nearest Azerbaijan/CIS size in halves (34 = size 17); a tie goes to the larger size. */
  sizeHalves: bigint;
  /** ISO 8653 size: inner circumference rounded to a whole mm. */
  isoSize: bigint;
};

/** All values for an inner diameter given in hundredths of a mm. */
export function fromDiameter(dHundredths: bigint): RingMeasure {
  // C [tenths] = d/100 × π × 10
  return {
    diameterTenths: roundDiv(dHundredths, BigInt(10)),
    circumferenceTenths: roundDiv(dHundredths * PI_NUM, PI_DEN * BigInt(10)),
    sizeHalves: roundDiv(dHundredths, BigInt(50)),
    isoSize: roundDiv(dHundredths * PI_NUM, PI_DEN * BigInt(100)),
  };
}

/** All values for an inner circumference given in hundredths of a mm. */
export function fromCircumference(cHundredths: bigint): RingMeasure {
  // d [tenths] = c/100 / π × 10
  return {
    diameterTenths: roundDiv(cHundredths * PI_DEN, PI_NUM * BigInt(10)),
    circumferenceTenths: roundDiv(cHundredths, BigInt(10)),
    sizeHalves: roundDiv(cHundredths * PI_DEN, PI_NUM * BigInt(50)),
    isoSize: roundDiv(cHundredths, BigInt(100)),
  };
}

/** True when the size lies inside the table (15 to 24). */
export const inTable = (sizeHalves: bigint) =>
  sizeHalves >= MIN_SIZE_HALVES && sizeHalves <= MAX_SIZE_HALVES;

export type RingRow = RingMeasure;

/** The table rows: one per Azerbaijan/CIS size, diameter = size in mm. */
export function ringTable(): RingRow[] {
  const rows: RingRow[] = [];
  for (let h = MIN_SIZE_HALVES; h <= MAX_SIZE_HALVES; h++) rows.push(fromDiameter(h * BigInt(50)));
  return rows;
}

type Locale = "az" | "en" | "ru";
const DECIMAL: Record<Locale, string> = { az: ",", en: ".", ru: "," };

/** Tenths of a mm as text with exactly one decimal: BigInt(534) -> "53,4" (az, ru) or "53.4" (en). */
export function formatTenths(tenths: bigint, locale: Locale): string {
  return `${tenths / BigInt(10)}${DECIMAL[locale]}${tenths % BigInt(10)}`;
}

/** A size in halves as text: BigInt(34) -> "17", BigInt(35) -> "17,5" (az, ru) or "17.5" (en). */
export function formatSize(halves: bigint, locale: Locale): string {
  return halves % BigInt(2) === BigInt(0)
    ? `${halves / BigInt(2)}`
    : `${halves / BigInt(2)}${DECIMAL[locale]}5`;
}
