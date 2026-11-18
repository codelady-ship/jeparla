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

  // Sample states (demo data, mock and API alike): bijouterie product 60 (#128), hallmark and label
  // photos of product 13 (#106).
  test("bijouterie product page and catalog section", async ({ page }) => {
    await check(page, "/az/products/qolbaqlar-polad-60");
    await expect(page.getByText(/Bu məhsul qiymətli metal deyil/)).toBeVisible();

    await check(page, "/az/products?kind=FASHION");
    await expect(page.getByRole("link", { name: "Paslanmaz polad qolbaq" }).first()).toBeVisible();
    await expect(page.getByText("Bijuteriya").first()).toBeVisible();
  });

  test("product page with hallmark and label photos, and the catalog filter", async ({ page }) => {
    await check(page, "/az/products/sirgalar-gold-585-13");
    const evidence = page.getByRole("region", { name: "Damğa və etiket" });
    await expect(evidence).toBeVisible();
    await expect(evidence.getByText(/administratoru şəkli/)).toBeVisible();
    await expect(
      page.getByRole("img", { name: /əyar damğasının yaxın planda şəkli/ }),
    ).toBeAttached();
    await expect(page.getByRole("img", { name: /etiketin şəkli/ })).toBeAttached();

    await check(page, "/az/products?hallmarkPhoto=true");
    await expect(page.getByRole("link", { name: "Səma — qızıl sırğa 585" }).first()).toBeVisible();
  });

  test("favorites whose price changed since they were added", async ({ page }) => {
    await page.goto("/az/products");
    const add = page
      .getByRole("article")
      .first()
      .getByRole("button", { name: "Seçilmişlərə əlavə et" });
    await waitForHydration(add);
    await add.click();
    // As if the favourite was added when the price was lower: the saved price goes back, and the
    // header's hourly price check is forgotten so it asks again.
    await page.evaluate(() => {
      const key = "jeparla-favorite-prices";
      const saved = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, object>;
      for (const id of Object.keys(saved)) saved[id] = { ...saved[id], amount: "1.00" };
      localStorage.setItem(key, JSON.stringify(saved));
      sessionStorage.removeItem("jeparla-favorite-prices-check");
    });

    // The quiet header note (a dot, read out after the link label) on any page.
    await check(page, "/az/stores");
    await expect(page.getByText(": 1 məhsulun qiyməti dəyişib").first()).toBeAttached({
      timeout: 15_000,
    });
    await expectNoA11yViolations(page);

    await check(page, "/az/favorites");
    const changes = page.getByRole("region", { name: "Əlavə etdiyinizdən bəri qiymət dəyişib" });
    await expect(changes).toBeVisible();
    await expect(changes.getByText(/bahalaşıb/)).toBeVisible();
    await expect(changes.getByText(/^Səbəb: /).first()).toBeVisible();
  });

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

  test("admin evidence queue with a photo waiting for the check", async ({ page }) => {
    await signIn(page, "admin");
    await check(page, "/az/admin/evidence");
    await expect(page.getByText("Səma — qızıl sırğa 585").first()).toBeVisible();
  });
});
