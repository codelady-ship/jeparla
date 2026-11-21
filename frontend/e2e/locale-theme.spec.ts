import { expect, expectNoA11yViolations, isPhone, test, waitForHydration } from "./fixtures";

test.describe("language and theme", () => {
  test("switches the language and keeps the page", async ({ page }) => {
    await page.goto("/az/products");
    await expect(page.locator("html")).toHaveAttribute("lang", "az");
    if (isPhone(page)) await page.getByRole("button", { name: "Menyu" }).click();
    const scope = isPhone(page) ? page.getByRole("dialog") : page.getByRole("banner");
    const menu = scope.getByRole("button", { name: /^Dil/ });
    await waitForHydration(menu);
    await menu.click();
    await scope.getByRole("button", { name: "English", exact: true }).click();

    await expect(page).toHaveURL(/\/en\/products/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1, name: "Catalog" })).toBeVisible();

    await page.goto("/ru/products");
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/[А-Яа-я]/);
  });

  test("switches to the dark theme and remembers it", async ({ page }) => {
    await page.goto("/az");
    await page.getByRole("banner").getByRole("button", { name: "Gecə rejiminə keç" }).click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    // A double click returns to light, not into a broken state.
    const toggle = page.getByRole("banner").getByRole("button", { name: /rejiminə keç/ });
    await toggle.dblclick();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await toggle.click();
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  });

  test("the home page has no axe violations in either theme", async ({ page }) => {
    await page.goto("/az");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoA11yViolations(page);
    await page.getByRole("banner").getByRole("button", { name: "Gecə rejiminə keç" }).click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expectNoA11yViolations(page);
  });
});
