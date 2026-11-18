import type { Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";

/**
 * Guides (#63, PLAN 5.18): the index and the guides of the second set, at 390px and 1440px
 * (both Playwright projects). Each page: one h1, canonical and hreflang, Article and
 * BreadcrumbList JSON-LD, a sources block with external links, no sideways scroll, no axe
 * violations.
 */
async function ldTypes(page: Page): Promise<string[]> {
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  return ld.flatMap((s) =>
    (JSON.parse(s)["@graph"] ?? []).map((n: { "@type": string }) => n["@type"]),
  );
}

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(0);
}

test.describe("guides (#63)", () => {
  test("the index lists every guide and links the reference pages", async ({ page }) => {
    await page.goto("/az/guides");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bələdçilər");
    await expect(page.getByRole("heading", { level: 2, name: /^Əyar cədvəli/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Nişan üzüyü alarkən/ })).toBeVisible();
    const related = page.getByRole("region", { name: "Faydalı səhifələr" });
    await expect(related.getByRole("link")).toHaveCount(3);
    expect(await ldTypes(page)).toEqual(expect.arrayContaining(["BreadcrumbList", "ItemList"]));
    await expectNoSidewaysScroll(page);
    await expectNoA11yViolations(page);
  });

  for (const [locale, slug, h1] of [
    ["az", "fineness-chart", /Əyar cədvəli/],
    ["en", "bijouterie-vs-precious", /Fashion jewelry and precious jewelry/],
    ["ru", "gold-jewelry-care", /Уход за золотыми украшениями/],
    ["az", "engagement-ring-buying", /Nişan üzüyü alarkən/],
  ] as const) {
    test(`${locale}/${slug}: structure, sources, structured data and axe`, async ({ page }) => {
      await page.goto(`/${locale}/guides/${slug}`);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(h1);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        new RegExp(`/${locale}/guides/${slug}$`),
      );
      await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
        "href",
        new RegExp(`/en/guides/${slug}$`),
      );
      expect(await ldTypes(page)).toEqual(expect.arrayContaining(["Article", "BreadcrumbList"]));

      const sources = page.getByRole("region").filter({ has: page.locator("h2#sources") });
      const links = sources.getByRole("link");
      expect(await links.count()).toBeGreaterThan(0);
      for (const href of await links.evaluateAll((as) => as.map((a) => a.getAttribute("href"))))
        expect(href).toMatch(/^https:\/\//);

      await expectNoSidewaysScroll(page);
      await expectNoA11yViolations(page);
    });
  }

  test("the fineness chart is a real table with row headers", async ({ page }) => {
    await page.goto("/en/guides/fineness-chart");
    const gold = page.getByRole("table", { name: /Gold fineness/ });
    await expect(gold.getByRole("columnheader")).toHaveText(["Fineness", "Pure gold", "Karat"]);
    await expect(gold.getByRole("rowheader")).toHaveText(["375", "585", "750", "916", "999"]);
    await expect(gold.getByRole("row", { name: /^585 / }).getByRole("cell")).toHaveText([
      "58.5%",
      "14",
    ]);
  });

  test("the prices pages and a bijouterie product link the guides that explain them", async ({
    page,
  }) => {
    await page.goto("/en/prices");
    await expect(page.getByRole("link", { name: /Guide: Fineness chart/ })).toBeVisible();
    await page.goto("/en/prices/monthly");
    await expect(
      page.getByRole("link", { name: /Guide: How the gold price is calculated/ }),
    ).toBeVisible();
    await page.goto("/az/products/qolbaqlar-polad-60");
    await page.getByRole("link", { name: /Bələdçi: Bijuteriya və qiymətli zərgərlik/ }).click();
    await expect(page).toHaveURL(/\/az\/guides\/bijouterie-vs-precious$/);
  });
});
