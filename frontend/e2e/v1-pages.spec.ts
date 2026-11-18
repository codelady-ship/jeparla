import type { Page } from "@playwright/test";
import { account, expect, expectNoA11yViolations, test, waitForHydration } from "./fixtures";

/**
 * v1 acceptance (#47): axe (WCAG 2.1 AA) and no sideways scroll at 390px and 1440px on the
 * pages added for #100, #104, #106, #112, #116, #128 and #174, with the sample data.
 */
async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(0);
}

async function check(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expectNoSidewaysScroll(page);
  await expectNoA11yViolations(page);
}

async function signIn(page: Page, role: "merchant" | "admin") {
  const { email, password } = account(role);
  await page.goto("/en/login");
  const field = page.getByLabel("E-mail");
  await waitForHydration(field);
  await field.fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test.describe("v1 pages: axe and 390px", () => {
  for (const path of [
    "/az/products/nisan-uzukleri-gold-585-1",
    "/ru/products/toy-uzukleri-silver-925-2",
    "/az/stores",
    "/az/stores/ayzer-zerger",
    "/az/products?kind=FASHION",
    "/az/products?hallmarkPhoto=true",
  ]) {
    test(`public ${path}`, async ({ page }) => {
      await check(page, path);
    });
  }

  test("favorites with a saved product", async ({ page }) => {
    await page.goto("/az/products");
    await page
      .getByRole("article")
      .first()
      .getByRole("button", { name: "Seçilmişlərə əlavə et" })
      .click();
    await check(page, "/az/favorites");
  });

  for (const path of [
    "/az/merchant/share",
    "/az/merchant/profile",
    "/az/merchant/products/new",
    "/az/merchant/products",
  ]) {
    test(`merchant ${path}`, async ({ page }) => {
      await signIn(page, "merchant");
      await check(page, path);
    });
  }

  for (const path of ["/az/admin/evidence", "/az/admin/stores"]) {
    test(`admin ${path}`, async ({ page }) => {
      await signIn(page, "admin");
      await check(page, path);
    });
  }
});
