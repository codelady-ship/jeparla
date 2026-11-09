import { expect, expectNoA11yViolations, test } from "./fixtures";

test.describe("search", () => {
  test("finds a store by a name with Azerbaijani letters", async ({ page }) => {
    await page.goto("/az/search");
    const box = page.getByRole("searchbox", { name: "Axtarış sözü" });
    await box.fill("Ayzər");
    await box.press("Enter");

    await expect(page).toHaveURL(/q=Ayz%C9%99r/);
    const kinds = page.getByRole("navigation", { name: "Nəticə növləri" });
    await expect(kinds.getByRole("link", { name: /^Mağazalar 1$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ayzər Zərgər" }).first()).toBeVisible();

    await kinds.getByRole("link", { name: /^Mağazalar/ }).click();
    await expect(page).toHaveURL(/\/search\/stores/);
    await page.getByRole("link", { name: "Ayzər Zərgər" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Ayzər Zərgər" })).toBeVisible();
  });

  test("finds a category", async ({ page }) => {
    await page.goto(`/az/search?q=${encodeURIComponent("sırğa")}`);
    const kinds = page.getByRole("navigation", { name: "Nəticə növləri" });
    await expect(kinds.getByRole("link", { name: /^Kateqoriyalar [1-9]/ })).toBeVisible();
  });

  test("an empty query shows suggestions and a very long one does not break the page", async ({
    page,
  }) => {
    await page.goto("/az/search");
    await expect(page.getByRole("heading", { level: 2, name: "Nə axtarırsınız?" })).toBeVisible();
    await page.goto(`/az/search?q=${encodeURIComponent("ş".repeat(300))}`);
    await expect(page.getByRole("heading", { level: 1, name: "Axtarış" })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });

  test("search results have no axe violations", async ({ page }) => {
    await page.goto(`/az/search?q=${encodeURIComponent("Ayzər")}`);
    await expect(page.getByRole("navigation", { name: "Nəticə növləri" })).toBeVisible();
    await expectNoA11yViolations(page);
  });
});
