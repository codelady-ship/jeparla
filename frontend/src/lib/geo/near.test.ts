import { describe, expect, it } from "vitest";
import { formatNear, haversineKm, normalizeNear, parseNear } from "./near";

describe("near", () => {
  it("parses a lat,lng pair", () => {
    expect(parseNear("40.4093,49.8671")).toEqual({ lat: 40.4093, lng: 49.8671 });
    expect(parseNear(" 40.4 , 49.8 ")).toEqual({ lat: 40.4, lng: 49.8 });
  });

  it("refuses invalid and out-of-range values", () => {
    for (const v of [undefined, "", "abc", "40.4", "91,10", "10,181", "40.4;49.8", "1e2,3"]) {
      expect(parseNear(v)).toBeNull();
    }
  });

  it("rounds to two decimals for the URL", () => {
    expect(formatNear({ lat: 40.40934, lng: 49.86716 })).toBe("40.41,49.87");
    expect(normalizeNear("40.40934,49.86716")).toBe("40.41,49.87");
    expect(normalizeNear("x")).toBeNull();
  });

  it("measures Baku to Ganja at about 295 km", () => {
    const km = haversineKm({ lat: 40.4093, lng: 49.8671 }, { lat: 40.6828, lng: 46.3606 });
    expect(km).toBeGreaterThan(290);
    expect(km).toBeLessThan(300);
  });
});
