import { allowNotFound, expect, expectNoA11yViolations, isPhone, test } from "./fixtures";

test.describe("catalog filter -> product page -> WhatsApp", () => {
  test("filters by metal, opens a product and links to the store on WhatsApp", async ({ page }) => {
    await page.goto("/az/products");
    await expect(page.getByRole("heading", { level: 1, name: "Kataloq" })).toBeVisible();
    const total = page.getByText(/^\d+ məhsul$/);
    await expect(total).toBeVisible();
    const before = Number((await total.textContent())!.split(" ")[0]);

    // Phones get the same filter form in a sheet.
    const scope = isPhone(page)
      ? (await page.getByRole("button", { name: /Filtrlər/ }).click(), page.getByRole("dialog"))
      : page.getByRole("complementary", { name: "Filtrlər" });
    await scope.getByRole("radio", { name: "Gümüş" }).check();
    await scope.getByRole("button", { name: "Göstər" }).click();

    await expect(page).toHaveURL(/metal=SILVER/);
    await expect(total).not.toHaveText(`${before} məhsul`);
    const cards = page
      .getByRole("heading", { level: 2, name: "Nəticələr" })
      .locator("xpath=following-sibling::ul[1]");
    await expect(cards.getByText(/^Gümüş \d+/).first()).toBeVisible();
    await expect(cards.getByText(/^Qızıl \d+/)).toHaveCount(0);

    const first = cards.getByRole("heading", { level: 3 }).first().getByRole("link");
    const name = (await first.textContent())!.trim();
    await first.click();

    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    const wa = page.getByRole("link", { name: "WhatsApp ilə mağazaya yaz" });
    const href = (await wa.getAttribute("href"))!;
    expect(href).toMatch(/^https:\/\/wa\.me\/994\d{9}\?text=/);
    // The prefilled message names the product, Azerbaijani letters intact.
    expect(decodeURIComponent(new URL(href).searchParams.get("text")!)).toContain(name);

    // Back returns to the filtered list.
    await page.goBack();
    await expect(page).toHaveURL(/metal=SILVER/);
  });

  test("a filter with no matches shows an empty state, not an error", async ({ page }) => {
    await page.goto("/az/products?metal=SILVER&minPrice=9999999");
    await expect(
      page.getByRole("heading", { name: "Bu filtrlərlə məhsul tapılmadı" }),
    ).toBeVisible();
  });

  // The proxy checks the slug before the page streams (#93, #41).
  test("an unknown product slug answers with HTTP 404", async ({ request }) => {
    const res = await request.get("/az/products/movcud-olmayan-mehsul", {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      },
    });
    expect(res.status()).toBe(404);
  });

  test("an unknown product slug shows the 404 page and is not indexed", async ({ page }) => {
    allowNotFound();
    await page.goto("/az/products/movcud-olmayan-mehsul");
    await expect(page.getByRole("heading", { level: 1, name: "Səhifə tapılmadı" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("product page explains a metal-linked price with the seller's parts only (#104)", async ({
    page,
  }) => {
    await page.goto("/az/products/nisan-uzukleri-gold-585-1");
    const block = page.getByTestId("price-breakdown");
    await block.locator("summary").click();
    const row = (label: string) => block.getByRole("row", { name: new RegExp(`^${label}`) });
    await expect(row("Metal dəyəri")).toContainText("585/1000");
    await expect(row("İşçilik və mağaza payı")).toBeVisible();
    await expect(row("Daş")).toContainText("satıcıdan");
    await expect(block.getByRole("link", { name: "AMB bülletenini aç" })).toHaveAttribute(
      "href",
      "https://www.cbar.az/currencies/03.11.2026.xml",
    );
    // The total is the variant price from the JSON-LD offer, never a recomputed sum.
    const text = await page.locator('script[type="application/ld+json"]').first().textContent();
    const graph = (JSON.parse(text!) as { "@graph": Record<string, unknown>[] })["@graph"];
    const offer = (graph.find((n) => n["@type"] === "Product") as { offers: { price: string } })
      .offers.price;
    const digits = (s: string) => s.replace(/\D/g, "");
    expect(digits((await row("Cəmi").locator("td").textContent())!)).toBe(digits(offer));
    await expectNoA11yViolations(page);
  });

  test("catalog and product page have no axe violations", async ({ page }) => {
    await page.goto("/az/products");
    await expect(page.getByText(/^\d+ məhsul$/)).toBeVisible();
    await expectNoA11yViolations(page);
    await page.goto("/az/products/nisan-uzukleri-gold-585-1");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoA11yViolations(page);
  });
});
