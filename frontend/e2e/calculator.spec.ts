import { expect, expectNoA11yViolations, test, waitForHydration } from "./fixtures";

test.describe("gold and silver calculator (#105)", () => {
  test("a shared link shows its result from the server", async ({ page }) => {
    await page.goto("/az/calculator?metal=gold&fineness=585&weight=4,2");
    await expect(
      page.getByRole("heading", { level: 1, name: "Qızıl və gümüş kalkulyatoru" }),
    ).toBeVisible();
    await expect(page.getByTestId("calc-value")).toHaveText(/^\d[\d.]*,\d{2}\s₼$/);
    await expect(page.getByText("4,2 q, Qızıl 585")).toBeVisible();
    await expect(page.getByText(/yalnız metalın dəyəridir, mağaza qiyməti deyil/)).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("recalculates as you type and keeps the link shareable", async ({ page }) => {
    await page.goto("/en/calculator");
    const weight = page.getByLabel("Weight (grams)");
    await waitForHydration(weight);
    await expect(page.getByText("Enter the weight to see the metal value.")).toBeVisible();

    await page.getByText("Silver", { exact: true }).click();
    await page.getByLabel("Fineness").selectOption("925");
    await weight.fill("10,5");
    await expect(page.getByTestId("calc-value")).toHaveText(/^AZN\s[\d,]+\.\d{2}$/);
    await expect(page).toHaveURL(/metal=silver&fineness=925&weight=10\.5/);
    const first = await page.getByTestId("calc-value").textContent();

    await weight.fill("21");
    await expect(page.getByTestId("calc-value")).not.toHaveText(first!);

    await weight.fill("-1");
    await expect(page.getByText("The weight must be greater than zero.")).toBeVisible();
    await expect(page.getByTestId("calc-value")).toHaveCount(0);
    await expect(weight).toHaveAttribute("aria-invalid", "true");
    await expectNoA11yViolations(page);
  });
});
