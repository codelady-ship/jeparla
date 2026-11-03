import { describe, expect, it } from "vitest";
import { alternates, SITE_URL } from "./alternates";

describe("alternates", () => {
  it("builds canonical and hreflang links for every locale plus x-default", () => {
    const a = alternates("en", "/products");
    expect(a?.canonical).toBe(`${SITE_URL}/en/products`);
    expect(a?.languages).toEqual({
      az: `${SITE_URL}/az/products`,
      en: `${SITE_URL}/en/products`,
      ru: `${SITE_URL}/ru/products`,
      "x-default": `${SITE_URL}/az/products`,
    });
  });

  it("treats the home page as no path", () => {
    expect(alternates("ru", "/")?.canonical).toBe(`${SITE_URL}/ru`);
  });
});
