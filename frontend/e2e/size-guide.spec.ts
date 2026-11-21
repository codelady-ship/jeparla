import { expect, expectNoA11yViolations, test, waitForHydration } from "./fixtures";

test.describe("size guide (#114)", () => {
  for (const [locale, h1] of [
    ["az", /Ölçü bələdçisi/],
    ["en", /Size guide/],
    ["ru", /Таблица размеров/],
  ] as const) {
    test(`${locale}: tables, structured data and no axe violations`, async ({ page }) => {
      await page.goto(`/${locale}/size-guide`);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(h1);

      // Real tables with a caption, column headers and one row header per size.
      const rings = page.getByRole("table").first();
      await expect(rings.locator("caption")).not.toBeEmpty();
      await expect(rings.getByRole("columnheader")).toHaveCount(4);
      await expect(rings.getByRole("rowheader")).toHaveCount(19);
      await expect(page.getByRole("table")).toHaveCount(3);

      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        new RegExp(`/${locale}/size-guide$`),
      );
      await expect(page.locator('link[rel="alternate"][hreflang="ru"]')).toHaveAttribute(
        "href",
        /\/ru\/size-guide$/,
      );
      const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
      const types = ld.flatMap((s) =>
        (JSON.parse(s)["@graph"] ?? []).map((n: { "@type": string }) => n["@type"]),
      );
      expect(types).toEqual(expect.arrayContaining(["Article", "HowTo", "BreadcrumbList"]));

      await expectNoA11yViolations(page);
    });
  }

  test("the size 17 row reads 17.0 mm across and 53.4 mm around", async ({ page }) => {
    await page.goto("/en/size-guide");
    const row = page.getByRole("row", { name: /^17 / });
    await expect(row.getByRole("cell")).toHaveText(["17.0", "53.4", "53"]);
  });

  test("the helper finds the nearest size from a circumference or a diameter", async ({ page }) => {
    await page.goto("/en/size-guide");
    const input = page.getByRole("textbox", { name: "Circumference, mm" });
    await waitForHydration(input);
    const result = page.locator("output");
    await expect(result).toHaveAttribute("aria-live", "polite");

    await input.fill("53,4");
    await expect(result).toContainText("Nearest size: 17");
    await expect(result).toContainText("Inner diameter 17.0 mm");

    await input.fill("abc");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(result).toContainText("Enter a number in millimetres");

    // The radio is visually hidden inside its chip; people click the chip (the label).
    await page.getByText("Inside diameter of a ring", { exact: true }).click();
    await expect(page.getByRole("radio", { name: "Inside diameter of a ring" })).toBeChecked();
    const diameter = page.getByRole("textbox", { name: "Inner diameter, mm" });
    await diameter.fill("16.5");
    await expect(result).toContainText("Nearest size: 16.5");
    await expect(result).toContainText("inner circumference 51.8 mm, ISO 8653 size 52");

    await diameter.fill("40");
    await expect(result).toContainText("outside the chart");
    await expectNoA11yViolations(page);
  });

  test("the buyers menu links to the guide", async ({ page }) => {
    await page.goto("/az");
    const menuButton = page.getByRole("button", { name: "Menyu" });
    if (await menuButton.isVisible()) {
      // Phones and tablets: the group is in the menu sheet.
      await menuButton.click();
      await page.getByRole("dialog").getByRole("link", { name: "Ölçü bələdçisi" }).click();
    } else {
      await page.getByRole("button", { name: "Alıcılar üçün" }).click();
      await page.getByRole("banner").getByRole("link", { name: "Ölçü bələdçisi" }).click();
    }
    await expect(page).toHaveURL(/\/az\/size-guide$/);
  });
});
