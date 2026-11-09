import { expect, expectNoA11yViolations, test } from "./fixtures";

test.describe("favorites and compare", () => {
  test("saves a product to favorites and removes it again", async ({ page }) => {
    await page.goto("/az/products");
    const card = page.getByRole("article").first();
    const name = (await card.getByRole("heading", { level: 3 }).textContent())!.trim();
    await card.getByRole("button", { name: "Seçilmişlərə əlavə et" }).click();

    await page.getByRole("banner").getByRole("link", { name: "Seçilmişlər" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Seçilmişlər" })).toBeVisible();
    const saved = page.getByRole("main").getByRole("article").filter({ hasText: name });
    await expect(saved).toHaveCount(1);

    // Survives a reload (stored in the browser).
    await page.reload();
    await expect(saved).toHaveCount(1);
    await expectNoA11yViolations(page);

    await saved.getByRole("button", { name: "Seçilmişlərdən çıxar" }).click();
    await expect(saved).toHaveCount(0);
  });

  test("compares two products and caps the list at four", async ({ page }) => {
    await page.goto("/az/products");
    const add = page.getByRole("button", { name: "Müqayisəyə əlavə et" });
    for (let i = 0; i < 4; i++) await add.nth(i).click();
    // A fifth product does not get in.
    await add.nth(4).click();
    await expect(page.getByRole("link", { name: /Müqayisə 4\/4/ })).toBeVisible();

    await page.getByRole("link", { name: /Müqayisə 4\/4/ }).click();
    const table = page.getByRole("table", { name: "Məhsulların müqayisəsi" });
    await expect(table).toBeVisible();
    await expect(table.getByRole("columnheader")).toHaveCount(4);
    await expect(table.getByRole("rowheader", { name: "Qiymət", exact: true })).toBeVisible();
    await expectNoA11yViolations(page);

    await table
      .getByRole("button", { name: /müqayisədən çıxar/ })
      .first()
      .click();
    await expect(table.getByRole("columnheader")).toHaveCount(3);
    await page.getByRole("button", { name: "Hamısını təmizlə" }).click();
    await expect(table).toHaveCount(0);
  });
});
