import { describe, expect, it } from "vitest";
import type { MetalPrice } from "@/types/api";
import { monthlySummaries } from "./monthly";

const q = (date: string, pricePerGram: string, extra: Partial<MetalPrice> = {}): MetalPrice => ({
  metal: "GOLD",
  date,
  pricePerOunce: "0",
  pricePerGram,
  currency: "AZN",
  source: "CBAR",
  fetchedAt: `${date}T10:05:00+04:00`,
  ...extra,
});

describe("monthly metal price overview (#63)", () => {
  const history = [
    q("2026-10-30", "180.0000"),
    q("2026-11-02", "182.0000"),
    q("2026-11-03", "179.5000"),
    q("2026-11-04", "185.2500"),
    q("2026-11-05", "184.0000"),
    q("2026-11-05", "184.1000", { metal: "SILVER" }),
  ];

  it("summarises each month from the stored quotes only, newest month first", () => {
    const [nov, oct] = monthlySummaries(history, "GOLD");
    expect(nov.month).toBe("2026-11");
    expect(nov.quotes).toBe(4);
    expect(nov.first).toEqual({ date: "2026-11-02", price: "182.00" });
    expect(nov.last).toEqual({ date: "2026-11-05", price: "184.00" });
    expect(nov.low).toEqual({ date: "2026-11-03", price: "179.50" });
    expect(nov.high).toEqual({ date: "2026-11-04", price: "185.25" });
    // (182 + 179.5 + 185.25 + 184) / 4 = 182.6875
    expect(nov.average).toBe("182.69");
    expect(nov.change).toBe("1.1");
    expect(oct).toMatchObject({ month: "2026-10", quotes: 1, change: "0.0" });
  });

  it("prices an alloy by its fineness", () => {
    const [nov] = monthlySummaries(history, "GOLD", 585);
    // 182 x 0.585 = 106.47
    expect(nov.first.price).toBe("106.47");
  });

  it("keeps one quote per date (the latest fetched) and marks admin corrections", () => {
    const corrected = [
      q("2026-11-02", "182.0000"),
      q("2026-11-02", "183.0000", { source: "ADMIN", fetchedAt: "2026-11-02T15:00:00+04:00" }),
    ];
    const [nov] = monthlySummaries(corrected, "GOLD");
    expect(nov.quotes).toBe(1);
    expect(nov.first.price).toBe("183.00");
    expect(nov.corrected).toBe(true);
  });

  it("has no month without quotes", () => {
    expect(monthlySummaries([], "GOLD")).toEqual([]);
    expect(monthlySummaries(history, "PLATINUM")).toEqual([]);
  });
});
