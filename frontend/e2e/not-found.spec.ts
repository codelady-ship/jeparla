import { allowNotFound, expect, expectNoA11yViolations, test } from "./fixtures";

// An unknown path under a language prefix gets the 404 page in that language, inside
// the site layout (header, footer), not the three-language global page (issue #182).
const CASES = [
  { locale: "az", title: "Səhifə tapılmadı" },
  { locale: "en", title: "Page not found" },
  { locale: "ru", title: "Страница не найдена" },
] as const;

test.describe("localized 404", () => {
  for (const { locale, title } of CASES) {
    test(`an unknown /${locale} path answers 404 in ${locale}`, async ({ page }) => {
      allowNotFound();
      const res = await page.goto(`/${locale}/nonexistent-page/deeper`);
      expect(res?.status()).toBe(404);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(page.getByRole("banner")).toBeVisible();
      await expect(page.getByRole("contentinfo")).toBeVisible();
      await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
      await expectNoA11yViolations(page);
    });
  }

  // The proxy sends a path without a language to the browser's language (Accept-Language).
  test.describe("a path without a language", () => {
    test.use({ locale: "ru-RU" });

    test("goes to the visitor's language first", async ({ page }) => {
      allowNotFound();
      const res = await page.goto("/nonexistent-page");
      expect(res?.status()).toBe(404);
      await expect(page).toHaveURL(/\/ru\/nonexistent-page$/);
      await expect(page.locator("html")).toHaveAttribute("lang", "ru");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Страница не найдена");
    });
  });
});
