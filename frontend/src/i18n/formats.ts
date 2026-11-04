import type { Formats } from "next-intl";

// Money and weight are formatted by lib/money (exact, same text on server and
// client); only dates go through Intl here.
export const formats = {
  dateTime: {
    short: { day: "numeric", month: "short", year: "numeric" },
    // Prices change once a day (CBAR), so the date is enough; az CLDR joins date and
    // time with a slash, which reads oddly.
    priceUpdated: { day: "numeric", month: "long", year: "numeric" },
  },
} satisfies Formats;
