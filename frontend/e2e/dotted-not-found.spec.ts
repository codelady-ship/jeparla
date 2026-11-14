import az from "../messages/az.json";
import { expect, test } from "./fixtures";

// Paths whose first segment has a dot skip the locale proxy (#186). They must still
// answer 404 with an Azerbaijani page, not the framework's English default.
for (const path of ["/foo.php", "/x.y/z", "/az/foo.php"]) {
  test(`${path} answers a localized 404`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", "az");
    await expect(page.getByText(az.Errors.notFoundTitle).first()).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByText("This page could not be found")).toHaveCount(0);
  });
}

test("real files with a dot are still served", async ({ request }) => {
  for (const path of ["/robots.txt", "/sitemap.xml", "/sw.js", "/logo.png"]) {
    expect((await request.get(path)).status(), path).toBe(200);
  }
});
