import type { Formats } from "next-intl";

// Prices arrive from the API as decimal strings (BigDecimal); Intl formats strings
// exactly, so they are never turned into floats.
export const formats = {
  number: {
    price: { style: "currency", currency: "AZN", minimumFractionDigits: 2 },
    grams: { style: "unit", unit: "gram", maximumFractionDigits: 3 },
  },
  dateTime: {
    short: { day: "numeric", month: "short", year: "numeric" },
    priceUpdated: { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" },
  },
} satisfies Formats;
