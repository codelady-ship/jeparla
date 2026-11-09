import { expect, expectNoA11yViolations, test, testPassword } from "./fixtures";

const next = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: "Davam et" }).click();

test.describe("seller sign-up wizard", () => {
  test("rejects a short password and keeps the step", async ({ page }) => {
    await page.goto("/az/sell");
    await page.getByLabel("Ad və soyad").fill("Əli Şükürov");
    await page.getByLabel("Mobil telefon").fill("050 123 45 67");
    await page.getByLabel("Şifrə").fill("abc1");
    await next(page);
    await expect(page.getByText("Addım 1 / 4", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Şifrə")).toHaveAttribute("aria-invalid", "true");
  });

  test("a shared link cannot skip ahead", async ({ page }) => {
    await page.goto("/az/sell?step=4");
    await expect(page.getByText("Addım 1 / 4", { exact: true })).toBeVisible();
  });

  test("completes all four steps, Back keeps the entered data", async ({ page }) => {
    await page.goto("/az/sell");
    await expectNoA11yViolations(page);
    await page.getByLabel("Ad və soyad").fill("Əli Şükürov");
    await page.getByLabel("Mobil telefon").fill("050 123 45 67");
    await page.getByLabel("Şifrə").fill(testPassword());
    await next(page);

    await expect(page.getByRole("heading", { level: 2, name: "Mağaza" })).toBeVisible();
    const store = "Gülşən Zərgər Evi";
    await page.getByLabel("Mağazanın adı").fill(store);
    await page.getByLabel("WhatsApp nömrəsi").fill("055 765 43 21");
    await page.getByLabel("Şəhər").selectOption({ label: "Gəncə" });
    await page.getByLabel("Ünvan").fill("Nizami küçəsi 12");
    await page.getByLabel("VÖEN").fill("1234567890");
    await next(page);

    await expect(page.getByText("Addım 3 / 4", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Geri" }).click();
    await expect(page.getByLabel("Mağazanın adı")).toHaveValue(store);
    await next(page);

    await expect(page.getByText("Addım 3 / 4", { exact: true })).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles({
      name: "vöen-şəhadətnaməsi.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n%e2e\n"),
    });
    await expect(page.getByText("vöen-şəhadətnaməsi.pdf")).toBeVisible();
    await next(page);

    await expect(page.getByText("Addım 4 / 4", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Məhsulsuz bitir" }).click();
    await expect(
      page
        .getByRole("heading", { level: 2 })
        .filter({ hasText: "Təbriklər! Siz qeydiyyatdan keçdiniz" }),
    ).toBeVisible();
  });
});
