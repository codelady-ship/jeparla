import { createFormatter } from "next-intl";
import { describe, expect, it } from "vitest";
import { formats } from "./formats";
import type { Locale } from "./routing";

const fmt = (locale: Locale) => createFormatter({ locale, formats, timeZone: "Asia/Baku" });

describe("formats", () => {
  it("formats AZN prices from decimal strings without float rounding", () => {
    // 0.1 + 0.2 style errors must not appear; the string goes to Intl as-is.
    const out = fmt("az").number("1248.50" as unknown as number, "price");
    expect(out).toContain("1");
    expect(out).toContain("248,50");
    expect(out).toMatch(/₼|AZN/);
  });

  it("keeps large values exact", () => {
    const out = fmt("en").number("12345678901234.56" as unknown as number, "price");
    expect(out.replace(/[^\d.]/g, "")).toBe("12345678901234.56");
  });

  it("uses the locale's separators", () => {
    expect(fmt("ru").number(1248.5, "price")).toMatch(/1\s248,50/);
  });
});
