import { describe, expect, it } from "vitest";
import { activeFilters, audienceMatches, parseFilters, toQuery } from "./filters";

describe("parseFilters", () => {
  it("reads valid params, repeated and comma separated", () => {
    expect(
      parseFilters({
        category: "uzukler",
        store: ["ayzer-zerger", "lale-atelye"],
        metal: "GOLD",
        fineness: "585,750",
        minPrice: "100",
        maxPrice: "2500.50",
        verified: "true",
        shape: ["ROUND", "OVAL"],
        sort: "price_asc",
        page: "3",
      }),
    ).toEqual({
      category: "uzukler",
      store: ["ayzer-zerger", "lale-atelye"],
      metal: "GOLD",
      fineness: [585, 750],
      minPrice: "100",
      maxPrice: "2500.50",
      verified: true,
      shape: ["ROUND", "OVAL"],
      sort: "price_asc",
      page: 2,
    });
  });

  it("drops malformed values instead of failing", () => {
    expect(
      parseFilters({
        metal: "WOOD",
        fineness: "abc",
        minPrice: "1e9",
        maxWeight: "-3",
        category: "../etc",
        sort: "random",
        page: "0",
        color: "Z",
        verified: "yes",
      }),
    ).toEqual({});
  });

  it("reads the material kind (#128) and drops unknown kinds", () => {
    expect(parseFilters({ kind: "FASHION" }).kind).toBe("FASHION");
    expect(parseFilters({ kind: "PRECIOUS" }).kind).toBe("PRECIOUS");
    expect(parseFilters({ kind: "gold" }).kind).toBeUndefined();
    expect(activeFilters({ kind: "FASHION" })).toHaveLength(1);
  });

  it("reads the audience (#121); unisex pieces count for women and men, not kids", () => {
    expect(parseFilters({ audience: "MEN" }).audience).toBe("MEN");
    expect(parseFilters({ audience: "adults" }).audience).toBeUndefined();
    expect(audienceMatches("UNISEX", "WOMEN")).toBe(true);
    expect(audienceMatches("UNISEX", "MEN")).toBe(true);
    expect(audienceMatches("UNISEX", "KIDS")).toBe(false);
    expect(audienceMatches("MEN", "WOMEN")).toBe(false);
    expect(audienceMatches("KIDS", "KIDS")).toBe(true);
  });

  it("keeps decimals as strings (no float)", () => {
    const f = parseFilters({ minCarat: "0.25" });
    expect(f.minCarat).toBe("0.25");
  });
});

describe("toQuery", () => {
  it("round-trips through parseFilters", () => {
    const f = parseFilters({ store: ["a", "b"], metal: "SILVER", page: "2", inStock: "1" });
    const q = toQuery(f);
    expect(q).toBe("?store=a&store=b&metal=SILVER&inStock=true&page=2");
    expect(parseFilters(Object.fromEntries(groupParams(q)))).toEqual(f);
  });

  it("returns an empty string when nothing is set", () => {
    expect(toQuery({})).toBe("");
    expect(toQuery({ page: 0 })).toBe("");
  });
});

describe("activeFilters", () => {
  it("makes one chip per value and removes only that value", () => {
    const chips = activeFilters({ store: ["a", "b"], metal: "GOLD", sort: "newest", page: 2 });
    expect(chips.map((c) => `${c.key}:${c.value}`)).toEqual(["store:a", "store:b", "metal:GOLD"]);
    expect(toQuery(chips[0].without)).toBe("?store=b&metal=GOLD&sort=newest");
  });
});

function groupParams(q: string): [string, string[]][] {
  const map = new Map<string, string[]>();
  new URLSearchParams(q).forEach((v, k) => map.set(k, [...(map.get(k) ?? []), v]));
  return [...map];
}
