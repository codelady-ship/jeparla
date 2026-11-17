import { expect, expectNoA11yViolations, test, testPassword, waitForHydration } from "./fixtures";

/**
 * Password reset and email verification pages (#131), with the sample data (no backend):
 * the calls succeed without sending anything, so the flows and states can be checked.
 */
test.describe("account recovery", () => {
  test("sign-in links to forgot-password, which answers the same for every address", async ({
    page,
  }) => {
    await page.goto("/en/login");
    await page.getByRole("link", { name: "Forgot your password?" }).click();
    await expect(page).toHaveURL(/\/en\/forgot-password$/);
    // Exact: the sign-in page stays mounted (hidden) after the client navigation, and its
    // "E-mail or phone" field would match too.
    const email = page.getByLabel("E-mail", { exact: true });
    await waitForHydration(email);
    await email.fill("nobody@example.com");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/If an account with this e-mail exists/)).toBeVisible();
  });

  test("a reset link clears its token from the address bar and sets a new password", async ({
    page,
  }) => {
    const response = await page.goto("/az/reset-password#token=e2eTokenAAAAAAAAAAAAAAAAAAAAAAAAAA");
    expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    const password = page.getByLabel("Şifrə", { exact: true });
    await waitForHydration(password);
    await expect(page).toHaveURL(/\/az\/reset-password$/);
    await expectNoA11yViolations(page);

    const value = testPassword();
    await password.fill(value);
    await page.getByLabel("Şifrəni təkrarlayın").fill(value);
    await page.getByRole("button", { name: "Şifrəni saxla" }).click();
    await expect(page.getByText(/Şifrəniz dəyişdirildi/)).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "Daxil ol" })).toHaveAttribute(
      "href",
      "/az/login",
    );
  });

  test("a reset page without a token offers a new link", async ({ page }) => {
    await page.goto("/ru/reset-password");
    await expect(page.getByText(/Ссылка недействительна/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Запросить новую ссылку" })).toHaveAttribute(
      "href",
      "/ru/forgot-password",
    );
  });

  test("a verification link confirms the address", async ({ page }) => {
    await page.goto("/en/verify-email#token=e2eTokenAAAAAAAAAAAAAAAAAAAAAAAAAA");
    await expect(page.getByText("Your e-mail is confirmed. Thank you.")).toBeVisible();
    await expect(page).toHaveURL(/\/en\/verify-email$/);
    await expectNoA11yViolations(page);
  });
});
