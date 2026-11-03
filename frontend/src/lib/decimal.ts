import type { Decimal } from "@/types/api";

/**
 * Intl.NumberFormat formats numeric strings exactly (ES2023), but next-intl types
 * only accept number | bigint. This cast passes the string through untouched,
 * so money never becomes a float. Use it only for display.
 */
export function asIntlNumber(value: Decimal): number {
  return value as unknown as number;
}
