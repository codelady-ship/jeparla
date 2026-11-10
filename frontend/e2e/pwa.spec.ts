import type { Page } from "@playwright/test";
import { expect, expectNoA11yViolations, isPhone, test, waitForHydration } from "./fixtures";

const RING = "/az/products/toy-uzukleri-silver-925-2";
const RING_2 = "/az/products/nisan-uzukleri-gold-585-1";
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

/**
 * Chrome fires beforeinstallprompt only for real installable sites after its own
 * heuristics; tests fire a stand-in with the same shape. `prompt()` is recorded.
 */
async function fireInstallEvent(page: Page) {
  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    e.prompt = async () => {
      (window as unknown as { __prompted: boolean }).__prompted = true;
    };
    e.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(e);
  });
}

/** Opens a product page and waits until the visit has been counted (after hydration). */
async function viewProduct(page: Page, path: string) {
  await page.goto(path);
  const slug = path.split("/").pop()!;
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("jeparla-pwa-products") ?? ""))
    .toContain(slug);
}

/** Two product pages: enough interest for the offer. */
async function showInterest(page: Page) {
  await viewProduct(page, RING);
  await viewProduct(page, RING_2);
}

const offer = (page: Page) => page.getByRole("complementary", { name: "Jeparla telefonunuzda" });

test.describe("install offer", () => {
  test("appears after two product pages and stays away once dismissed", async ({ page }) => {
    test.skip(!isPhone(page), "the phone flow");
    await viewProduct(page, RING);
    await fireInstallEvent(page);
    // One product page is not enough interest yet.
    await page.waitForTimeout(2000);
    await expect(offer(page)).toHaveCount(0);

    await viewProduct(page, RING_2);
    await fireInstallEvent(page);
    await expect(offer(page)).toBeVisible();
    await expect(offer(page)).toContainText("Əsas ekrana əlavə edin");
    await expectNoA11yViolations(page);

    await offer(page).getByRole("button", { name: "İndi yox" }).click();
    await expect(offer(page)).toHaveCount(0);

    await page.reload();
    await fireInstallEvent(page);
    await page.waitForTimeout(2000);
    await expect(offer(page)).toHaveCount(0);
  });

  test("hands over to the browser's install dialog", async ({ page }) => {
    await showInterest(page);
    await fireInstallEvent(page);
    await offer(page).getByRole("button", { name: "Əlavə et", exact: true }).click();
    await expect(offer(page)).toHaveCount(0);
    expect(
      await page.evaluate(() => (window as unknown as { __prompted?: boolean }).__prompted),
    ).toBe(true);
    // Accepted: never offered again.
    await page.reload();
    await fireInstallEvent(page);
    await page.waitForTimeout(2000);
    await expect(offer(page)).toHaveCount(0);
  });

  test("Escape dismisses it from the keyboard", async ({ page }) => {
    await showInterest(page);
    await fireInstallEvent(page);
    await offer(page).getByRole("button", { name: "İndi yox" }).focus();
    await page.keyboard.press("Escape");
    await expect(offer(page)).toHaveCount(0);
    await expect(page.locator("#main")).toBeFocused();
  });

  test("is never shown inside the installed app", async ({ page }) => {
    await page.addInitScript(() => {
      const real = window.matchMedia.bind(window);
      window.matchMedia = (q: string) =>
        q === "(display-mode: standalone)"
          ? ({ ...real(q), matches: true } as MediaQueryList)
          : real(q);
    });
    await showInterest(page);
    await fireInstallEvent(page);
    await page.waitForTimeout(2000);
    await expect(offer(page)).toHaveCount(0);
  });
});

test.describe("install offer on iPhone Safari", () => {
  test.use({ userAgent: IPHONE_SAFARI });

  test("explains Share, then Add to Home Screen", async ({ page }) => {
    test.skip(!isPhone(page), "the phone flow");
    await showInterest(page);
    const card = offer(page);
    await expect(card).toBeVisible();
    await expect(card.getByRole("listitem")).toHaveCount(2);
    await expect(card).toContainText("Add to Home Screen");
    await expectNoA11yViolations(page);
    await card.getByRole("button", { name: "Aydındır" }).click();
    await expect(card).toHaveCount(0);
  });
});

test.describe("share button", () => {
  test("copies the filtered catalog link on desktop", async ({ page }) => {
    test.skip(isPhone(page), "desktop copies");
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: async (text: string) => {
            (window as unknown as { __copied: string }).__copied = text;
          },
        },
      });
    });
    await page.goto("/az/products?metal=SILVER");
    const copy = page.getByRole("button", { name: "Linki kopyala" });
    await waitForHydration(copy);
    await copy.click();
    await expect(page.getByRole("status")).toContainText("Link kopyalandı");
    const copied = await page.evaluate(() => (window as unknown as { __copied: string }).__copied);
    expect(new URL(copied).pathname + new URL(copied).search).toBe("/az/products?metal=SILVER");
  });

  test("opens the system share sheet on phones", async ({ page }) => {
    test.skip(!isPhone(page), "phones share");
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", {
        value: async (data: ShareData) => {
          (window as unknown as { __shared: ShareData }).__shared = data;
        },
      });
    });
    await page.goto("/az/stores/ayzer-zerger");
    const share = page.getByRole("button", { name: "Paylaş" });
    await waitForHydration(share);
    await share.click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __shared?: ShareData }).__shared))
      .toMatchObject({
        title: "Ayzər Zərgər",
        url: expect.stringContaining("/az/stores/ayzer-zerger"),
      });
  });
});

test.describe("installable app", () => {
  test("serves a manifest per language with icons that load", async ({ page, request }) => {
    await page.goto("/en/categories/uzukler");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      "href",
      "/en/manifest.webmanifest",
    );
    const res = await request.get("/en/manifest.webmanifest");
    expect(res.headers()["content-type"]).toContain("application/manifest+json");
    const m = await res.json();
    expect(m).toMatchObject({
      name: "Jeparla",
      short_name: "Jeparla",
      display: "standalone",
      start_url: "/en",
      lang: "en",
    });
    expect(m.theme_color).toMatch(/^#[0-9A-F]{6}$/i);
    expect(m.shortcuts.map((s: { url: string }) => s.url)).toEqual([
      "/en/products",
      "/en/search",
      "/en/favorites",
    ]);
    for (const icon of m.icons) expect((await request.get(icon.src)).status()).toBe(200);
    expect(m.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
    expect((await request.get("/manifest.webmanifest")).status()).toBe(200);
  });

  test("shows the offline page when the network is gone", async ({ page, context }) => {
    test.skip(isPhone(page), "one viewport is enough for the worker");
    await page.goto("/ru/categories");
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
      timeout: 20_000,
    });
    await context.setOffline(true);
    await page.goto("/ru/stores");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Нет подключения к интернету");
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expectNoA11yViolations(page);
    await expect(page.getByRole("button", { name: "Попробовать снова" })).toBeVisible();
    // Back online: the page reloads by itself.
    await context.setOffline(false);
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(
      "Нет подключения к интернету",
    );
  });

  test("shows a replaced image after a reload (not the cached copy)", async ({ page, context }) => {
    test.skip(isPhone(page), "one viewport is enough for the worker");
    const image = "/demo/ring-gold-1.jpg";
    const bytes = () =>
      page.evaluate(async (u) => (await (await fetch(u)).arrayBuffer()).byteLength, image);
    await page.goto("/ru/categories");
    await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
      timeout: 20_000,
    });
    const original = await bytes();
    expect(original).toBeGreaterThan(0);
    // Now cached by the worker. The server gets a new file under the same URL.
    const replaced = Buffer.alloc(original + 30, 7);
    await context.route(`**${image}`, (route) =>
      route.fulfill({ status: 200, contentType: "image/jpeg", body: replaced }),
    );
    await page.reload();
    await expect.poll(bytes, { timeout: 15_000 }).toBe(replaced.length);
  });

  test("offline page is served directly in every language", async ({ page }) => {
    await page.goto("/az/offline.html");
    await expect(page.getByRole("heading", { level: 1, name: "İnternet yoxdur" })).toBeVisible();
    await expectNoA11yViolations(page);
  });
});
