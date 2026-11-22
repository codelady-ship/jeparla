import { expect, expectNoA11yViolations, test } from "./fixtures";

/**
 * The footer's "About" column: every link opens a real page (the about and contact pages
 * used to answer 404), and the buyers and sellers links open from the header menus.
 */
test.describe("about and contact pages", () => {
  for (const locale of ["az", "en", "ru"] as const) {
    for (const path of ["about", "contact"] as const) {
      test(`/${locale}/${path} answers 200 with a heading`, async ({ page }) => {
        const response = await page.goto(`/${locale}/${path}`);
        expect(response?.status()).toBe(200);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      });
    }
  }

  test("the footer links open the pages and they have no axe violations", async ({ page }) => {
    await page.goto("/az/help");
    const footer = page.getByRole("contentinfo");
    await footer.getByRole("link", { name: "Haqqımızda" }).click();
    await expect(page).toHaveURL(/\/az\/about$/);
    await expect(page.getByRole("heading", { level: 1, name: "Haqqımızda" })).toBeVisible();
    await expectNoA11yViolations(page);

    await footer.getByRole("link", { name: "Əlaqə" }).click();
    await expect(page).toHaveURL(/\/az\/contact$/);
    await expect(page.getByRole("heading", { level: 1, name: "Əlaqə" })).toBeVisible();
    await expectNoA11yViolations(page);
  });
});

test.describe("buyers and sellers menus in the header", () => {
  test("open below the entry, close with Escape and lead to the page", async ({ page }) => {
    await page.goto("/az/help");
    const entry = page.getByRole("button", { name: "Satıcılar üçün" });
    test.skip(!(await entry.isVisible()), "phones and tablets use the menu sheet");

    const link = page.getByRole("banner").getByRole("link", { name: "Mağaza aç" });
    await expect(link).toBeHidden();
    await entry.focus();
    await page.keyboard.press("Enter");
    await expect(entry).toHaveAttribute("aria-expanded", "true");
    await expect(link).toBeVisible();
    await expectNoA11yViolations(page);

    await page.keyboard.press("Escape");
    await expect(entry).toHaveAttribute("aria-expanded", "false");
    await expect(entry).toBeFocused();

    await entry.hover();
    await link.click();
    await expect(page).toHaveURL(/\/az\/sell$/);
  });

  test("on a phone the groups are in the menu sheet", async ({ page }) => {
    await page.goto("/az/help");
    const menu = page.getByRole("button", { name: "Menyu" });
    test.skip(!(await menu.isVisible()), "wide screens use the header menus");
    await menu.click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("heading", { name: "Alıcılar üçün" })).toBeVisible();
    await sheet.getByRole("link", { name: "Metal qiymətləri" }).click();
    await expect(page).toHaveURL(/\/az\/prices$/);
  });
});

test.describe("top bar above the header", () => {
  test("every note opens its page", async ({ page }) => {
    await page.goto("/az/help");
    const bar = page.locator("[data-topbar]");
    test.skip(!(await bar.isVisible()), "wide screens only");
    for (const [name, url] of [
      ["Mağazaya birbaşa WhatsApp ilə yazın", /\/az\/stores$/],
      ["Zəmanətli keyfiyyət", /\/az\/verified$/],
      ["Peşəkar dəstək", /\/az\/help$/],
      ["Qiymətlər hər gün AMB məzənnəsi ilə", /\/az\/prices$/],
    ] as const) {
      await bar.getByRole("link", { name }).click();
      await expect(page).toHaveURL(url);
    }
  });
});
