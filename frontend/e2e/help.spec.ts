import { expect, expectNoA11yViolations, test } from "./fixtures";

// Notifications without a configured support contact send sellers here (#167).
test.describe("help page", () => {
  for (const locale of ["az", "en", "ru"]) {
    test(`/${locale}/help answers 200 with a heading`, async ({ page }) => {
      const response = await page.goto(`/${locale}/help`);
      expect(response?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }

  test("is linked from the footer and has no axe violations", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("contentinfo").getByRole("link", { name: "Help and support" }).click();
    await expect(page).toHaveURL(/\/en\/help$/);
    await expect(page.getByRole("heading", { level: 1, name: "Help and support" })).toBeVisible();
    await expectNoA11yViolations(page);
  });
});
