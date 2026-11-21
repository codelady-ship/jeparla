import type { Page } from "@playwright/test";
import {
  account,
  allowNotFound,
  expect,
  expectNoA11yViolations,
  isPhone,
  test,
  waitForHydration,
} from "./fixtures";

/**
 * Occasion collections (#115): the index, a collection page with budget links, a real 404 for
 * an unknown collection and the admin list. axe (WCAG 2.1 AA) and no sideways scroll on both
 * viewports; budget links are at least 44px tall on the phone. Works on the sample data and
 * on the real API with the demo seed (the same tags).
 */
async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(0);
}

test.describe("occasion collections", () => {
  test("the index offers the collections with products", async ({ page }) => {
    await page.goto("/az/collections");
    await expect(
      page.getByRole("heading", { level: 1, name: "Münasibətə görə seçimlər" }),
    ).toBeVisible();
    const list = page.getByRole("list", { name: "Münasibətə görə seçimlər" });
    await expect(list.getByRole("link", { name: /^Nişan/ })).toHaveAttribute(
      "href",
      "/az/collections/nisan",
    );
    await expect(list.getByRole("link")).toHaveCount(6);
    // Photo cards: a product photo each, lazily loaded, two a row on phones and three on desktop.
    const photos = list.getByRole("img");
    await expect(photos).toHaveCount(6);
    for (const loading of await photos.evaluateAll((imgs) =>
      imgs.map((i) => i.getAttribute("loading")),
    ))
      expect(loading).toBe("lazy");
    const lefts = await list
      .getByRole("listitem")
      .evaluateAll((items) => items.map((i) => Math.round(i.getBoundingClientRect().left)));
    expect(new Set(lefts).size).toBe(isPhone(page) ? 2 : 3);
    await expectNoSidewaysScroll(page);
    await expectNoA11yViolations(page);
  });

  test("a collection page lists its products and filters by budget", async ({ page }) => {
    await page.goto("/az/collections/hediyye");
    await expect(page.getByRole("heading", { level: 1, name: "Hədiyyə" })).toBeVisible();
    await expect(page.getByRole("article").first()).toBeVisible();
    const budgets = page.getByRole("navigation", { name: "Büdcə" });
    await expect(budgets.getByRole("link", { name: "İstənilən qiymət" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expectNoSidewaysScroll(page);
    await expectNoA11yViolations(page);

    if (isPhone(page)) {
      for (const box of await budgets
        .getByRole("link")
        .evaluateAll((links) => links.map((l) => l.getBoundingClientRect().height)))
        expect(box, "budget link height in px").toBeGreaterThanOrEqual(44);
    }

    const first = budgets.getByRole("link", { name: /manata qədər/ }).first();
    const href = await first.getAttribute("href");
    expect(href).toMatch(/^\/az\/collections\/hediyye\?maxPrice=\d+$/);
    await page.goto(href!);
    await expect(
      page
        .getByRole("navigation", { name: "Büdcə" })
        .getByRole("link", { name: /manata qədər/ })
        .first(),
    ).toHaveAttribute("aria-current", "true");
    await expect(page.getByRole("article").first()).toBeVisible();
  });

  test("the page carries its breadcrumb and canonical address", async ({ page }) => {
    await page.goto("/en/collections/kisi-ucun?maxPrice=3000");
    await expect(page.getByRole("heading", { level: 1, name: "For him" })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/en\/collections\/kisi-ucun$/,
    );
    // The ItemList comes with the streamed product grid.
    await expect(page.getByRole("article").first()).toBeVisible();
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(ld.join("\n")).toContain('"BreadcrumbList"');
    expect(ld.join("\n")).toContain('"ItemList"');
  });

  test("an unknown collection answers 404", async ({ page }) => {
    allowNotFound();
    const res = await page.goto("/az/collections/no-such-collection");
    expect(res?.status()).toBe(404);
  });

  test("the admin sees the collections in the catalog settings", async ({ page }) => {
    const { email, password } = account("admin");
    await page.goto("/en/login");
    const field = page.getByLabel("E-mail");
    await waitForHydration(field);
    await field.fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).not.toHaveURL(/\/login/);
    await page.goto("/az/admin/catalog");
    await expect(
      page.getByRole("heading", { level: 2, name: "Münasibət seçimləri" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Nişan: aşağı" })).toBeVisible();
    await expectNoSidewaysScroll(page);
    await expectNoA11yViolations(page);
  });
});
