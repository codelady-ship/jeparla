import { describe, expect, it } from "vitest";
import { stripLocale } from "./strip-locale";

describe("stripLocale", () => {
  it("removes the locale prefix and keeps the rest of the path and query", () => {
    expect(stripLocale("/az/products/ring", "?metal=gold")).toBe("/products/ring?metal=gold");
  });
  it("maps a bare locale to the home page", () => {
    expect(stripLocale("/ru")).toBe("/");
  });
  it("does not touch segments that only start like a locale", () => {
    expect(stripLocale("/en/azure")).toBe("/azure");
    expect(stripLocale("/azure")).toBe("/azure");
  });
});
