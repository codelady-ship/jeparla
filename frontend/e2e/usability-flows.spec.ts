import type { Locator, Page } from "@playwright/test";
import {
  account,
  expect,
  expectNoA11yViolations,
  isPhone,
  REAL_API,
  test,
  testPassword,
  uniqueDigits,
  waitForHydration,
} from "./fixtures";

/**
 * "Simple and easy to use" (#176): the main flows are measured in steps, at 390px and
 * 1440px (the two projects), and a flow that needs more than its target fails here.
 *
 * What counts as a step: one click or tap on a control, or one choice in a list. Typing
 * into a field and scrolling are not steps. The last step of a buyer flow is the WhatsApp
 * link itself; it is checked but not followed (it leaves the site).
 *
 * Targets (issue #176):
 *   buyer, home -> product (search or category) -> WhatsApp link:  at most 3
 *   buyer, home -> stores of one city:                             at most 2
 *   seller, sign-up wizard:                                        at most 4 screens, one
 *                                                                  sentence of guidance each
 * Results and the test protocol with real people: docs/research/usability-2026.md.
 */
const BUYER_TO_WHATSAPP_MAX = 3;
const STORE_BY_CITY_MAX = 2;
const SELLER_WIZARD_SCREENS_MAX = 4;

// Each flow walks several screens and runs axe on them: more than one page's worth of time.
test.describe.configure({ timeout: 90_000 });

/** Counts the steps of one flow and names them, so a failure shows where the steps went. */
function flow(name: string) {
  const steps: string[] = [];
  return {
    steps,
    /** A click or tap on a control. */
    async tap(label: string, target: Locator) {
      await target.click();
      steps.push(label);
    },
    /** A step that is performed by the caller (a choice in a list) or only checked (an outside link). */
    count(label: string) {
      steps.push(label);
    },
    expectAtMost(max: number) {
      test.info().annotations.push({
        type: "steps",
        description: `${name}: ${steps.length} (target ${max}): ${steps.join(" -> ")}`,
      });
      expect(steps, `${name}: steps taken`).not.toHaveLength(0);
      expect(steps.length, `${name}: ${steps.join(" -> ")}`).toBeLessThanOrEqual(max);
    },
  };
}

async function openHome(page: Page) {
  await page.goto("/az");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

/** The product page ends the buyer flow: its WhatsApp link is one tap away, already filled in. */
async function expectWhatsAppLink(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const wa = page.getByRole("link", { name: "WhatsApp ilə mağazaya yaz" });
  await expect(wa).toBeVisible();
  expect(await wa.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/994\d{9}\?text=/);
  // A finger can hit it: at least 44px tall.
  expect((await wa.boundingBox())!.height).toBeGreaterThanOrEqual(44);
}

test.describe("usability: buyer finds a product and reaches the store on WhatsApp", () => {
  test("by search, in at most 3 taps", async ({ page }) => {
    const f = flow("home -> search -> product -> WhatsApp");
    await openHome(page);
    await expectNoA11yViolations(page);

    const open = page.getByRole("button", { name: "Axtarış" });
    await waitForHydration(open);
    await f.tap("search button", open);

    const dialog = page.getByRole("dialog");
    const box = dialog.getByRole("combobox");
    await expect(box).toBeFocused();
    await box.fill("sırğa");
    const product = dialog.getByRole("group", { name: "Məhsullar" }).getByRole("option").first();
    await expect(product).toBeVisible();
    await expectNoA11yViolations(page);
    await f.tap("product suggestion", product);

    await expect(page).toHaveURL(/\/az\/products\/.+/);
    await expectWhatsAppLink(page);
    f.count("WhatsApp link");
    await expectNoA11yViolations(page);

    f.expectAtMost(BUYER_TO_WHATSAPP_MAX);
  });

  test("by category, in at most 3 taps", async ({ page }) => {
    const f = flow("home -> category -> product -> WhatsApp");
    await openHome(page);

    const category = page
      .getByRole("region", { name: "Kateqoriyalar" })
      .getByRole("listitem")
      .first()
      .getByRole("link");
    await f.tap("category on the home page", category);

    await expect(page).toHaveURL(/\/az\/categories\/.+/);
    const card = page.getByRole("article").first().getByRole("heading").getByRole("link");
    await expect(card).toBeVisible();
    await expectNoA11yViolations(page);
    await f.tap("product card", card);

    await expect(page).toHaveURL(/\/az\/products\/.+/);
    await expectWhatsAppLink(page);
    f.count("WhatsApp link");

    f.expectAtMost(BUYER_TO_WHATSAPP_MAX);
  });
});

test.describe("usability: buyer finds the stores of a city", () => {
  test("in at most 2 steps", async ({ page }) => {
    const f = flow("home -> stores -> city");
    await openHome(page);

    // Desktop has "Stores" in the header; a phone has it as the second hero button, on the
    // first screen (through the menu it would be one tap more).
    const toStores = isPhone(page)
      ? page.getByRole("link", { name: "Mağazalara bax" })
      : page.getByRole("navigation", { name: "Əsas naviqasiya" }).getByRole("link", {
          name: "Mağazalar",
        });
    await f.tap("Stores link", toStores);

    await expect(page).toHaveURL(/\/az\/stores$/);
    const city = page.getByLabel("Şəhər");
    await waitForHydration(city);
    const cities = await city
      .locator("option")
      .evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
    expect(cities.length, "cities to choose from").toBeGreaterThan(0);
    await expectNoA11yViolations(page);

    // Choosing the city is the whole step: no second press on "Search".
    await city.selectOption(cities[0]);
    f.count(`city "${cities[0]}"`);

    await expect(page).toHaveURL(new RegExp(`city=${encodeURIComponent(cities[0])}`));
    const cards = page.getByRole("main").getByRole("article");
    await expect(cards.first()).toBeVisible();
    for (const text of await cards.allInnerTexts()) expect(text).toContain(cities[0]);
    await expectNoA11yViolations(page);

    f.expectAtMost(STORE_BY_CITY_MAX);
  });

  test("a city and name with no store says what to do next", async ({ page }) => {
    await page.goto(`/az/stores?q=${encodeURIComponent("belə mağaza yoxdur")}`);
    await expect(page.getByRole("heading", { level: 2, name: "Mağaza tapılmadı" })).toBeVisible();
    await expect(page.getByText(/Adı qısaldın, başqa şəhər seçin/)).toBeVisible();
    await expect(
      page.getByRole("main").getByRole("link", { name: "Bütün mağazalar" }),
    ).toBeVisible();
    await expectNoA11yViolations(page);
  });
});

test.describe("usability: seller signs up and adds the first product", () => {
  test("in at most 4 screens, each with one sentence of guidance", async ({ page }) => {
    test.slow();
    const f = flow("sign-up wizard screens");
    const next = page.getByRole("button", { name: "Davam et" });

    /** The screen says where the seller is and, in one sentence, what to do. */
    async function expectGuidance(step: number, title: string) {
      await expect(page.getByText(`Addım ${step} / 4`, { exact: true })).toBeVisible();
      const heading = page.getByRole("heading", { level: 2, name: title, exact: true });
      await expect(heading).toBeVisible();
      const intro = (await heading.locator("xpath=following-sibling::p[1]").innerText()).trim();
      expect(intro.length, `step ${step} guidance: "${intro}"`).toBeGreaterThan(20);
      expect(intro.split(/[.!?]\s+/), `step ${step}: one sentence`).toHaveLength(1);
      await expectNoA11yViolations(page);
    }

    await page.goto("/az/sell");
    const name = page.getByLabel("Ad və soyad");
    await waitForHydration(name);
    await expectGuidance(1, "Hesab");
    // Every field shows an example of what to type.
    await expect(name).toHaveAttribute("placeholder", /.+/);
    await name.fill("Əli Şükürov");
    // The API keeps every sign-up: a new phone, store name and tax id per run.
    await page.getByLabel("Mobil telefon").fill(`050 ${uniqueDigits(7)}`);
    await page.getByLabel("Şifrə").fill(testPassword());
    await f.tap("1 account", next);

    await expectGuidance(2, "Mağaza");
    const store = `Gülşən Zərgər Evi ${uniqueDigits(6)}`;
    for (const label of ["Mağazanın adı", "WhatsApp nömrəsi", "Ünvan", "VÖEN"]) {
      await expect(page.getByLabel(label)).toHaveAttribute("placeholder", /.+/);
    }
    await page.getByLabel("Mağazanın adı").fill(store);
    await page.getByLabel("WhatsApp nömrəsi").fill("055 765 43 21");
    await page.getByLabel("Şəhər").selectOption({ label: "Gəncə" });
    await page.getByLabel("Ünvan").fill("Nizami küçəsi 12");
    await page.getByLabel("VÖEN").fill(uniqueDigits(10));
    await page.getByRole("checkbox", { name: /Satıcı davranış kodeksini/ }).check();
    await f.tap("2 store", next);

    await expectGuidance(3, "Sənədlər");
    await page.locator('input[type="file"]').setInputFiles({
      name: "vöen-şəhadətnaməsi.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n%e2e\n"),
    });
    await expect(page.getByText("vöen-şəhadətnaməsi.pdf")).toBeVisible();
    await f.tap("3 documents", next);

    await expectGuidance(4, "İlk məhsul");
    await expect(page.getByLabel("Məhsulun adı")).toHaveAttribute("placeholder", /.+/);
    await page.getByLabel("Məhsulun adı").fill(`Qızıl üzük ${uniqueDigits(4)}`);
    await page.getByLabel("Kateqoriya").selectOption({ index: 1 });
    await page.getByLabel("Əyar").selectOption({ index: 1 });
    await page.getByLabel("Çəki").fill("3,25");
    await page.getByLabel("Qiymət").fill("450,00");
    // One primary button on the last screen; "finish without a product" is the quiet one.
    await f.tap("4 first product", page.getByRole("button", { name: "Qeydiyyatı bitir" }));

    await expect(
      page
        .getByRole("heading", { level: 2 })
        .filter({ hasText: "Təbriklər! Siz qeydiyyatdan keçdiniz" }),
    ).toBeVisible();
    // The seller learns what happens next and has one main way forward.
    await expect(page.getByRole("link", { name: "Kabinetə keç" })).toBeVisible();
    // The first product is a draft without photos: one tap to it (#301).
    await expect(
      page.getByRole("link", { name: "Şəkil əlavə et və yoxlamaya göndər" }),
    ).toHaveAttribute("href", /\/merchant\/products(\/\d+\/edit)?$/);
    await expectNoA11yViolations(page);

    f.expectAtMost(SELLER_WIZARD_SCREENS_MAX);
  });
});

test.describe("usability: seller cabinet", () => {
  async function signIn(page: Page) {
    const { email, password } = account("merchant");
    await page.goto("/en/login");
    const field = page.getByLabel("E-mail");
    await waitForHydration(field);
    await field.fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).not.toHaveURL(/\/login/);
  }

  /**
   * A new seller of its own: closing the guide is kept on the account (#301), so the shared
   * seeded seller would carry it from one project or retry to the next.
   */
  async function newSeller(page: Page) {
    const phone = `050 ${uniqueDigits(7)}`;
    const res = await page.request.post("/api/auth/seller", {
      data: {
        account: { name: "Gülşən Əliyeva", phone, password: testPassword() },
        store: {
          storeName: `Bələdçi Zərgər ${uniqueDigits(6)}`,
          whatsapp: "055 765 43 21",
          city: "Gəncə",
          address: "Nizami küçəsi 12",
          social: "",
          legalType: "COMPANY",
          sellerKind: "PRECIOUS",
          taxId: uniqueDigits(10),
          codeAccepted: true,
        },
        docs: { docs: [] },
        product: null,
      },
    });
    expect(res.status(), await res.text()).toBe(201);
  }

  test("the 3-step guide shows on the first visit and never again once closed", async ({
    page,
    browser,
  }) => {
    await newSeller(page);
    await page.goto("/az/merchant");
    const guide = page.getByRole("region", { name: "Mağazanızı 3 addımda hazırlayın" });
    await expect(guide).toBeVisible();
    await expect(guide.getByRole("listitem")).toHaveCount(3);
    await expectNoA11yViolations(page);

    // Each step is one link, and the close button is a finger-sized target.
    for (const link of await guide.getByRole("link").all()) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    const close = guide.getByRole("button", { name: "Aydındır, bağla" });
    const box = (await close.boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);

    await close.click();
    await expect(guide).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Panel" })).toBeVisible();
    await expect(guide).toHaveCount(0);

    // A second device (same account, empty browser storage) does not show it either (#301).
    // The sample data has no account to keep it on.
    if (REAL_API) {
      const other = await browser.newContext({
        storageState: { ...(await page.context().storageState()), origins: [] },
      });
      const second = await other.newPage();
      await second.goto("/az/merchant");
      await expect(second.getByRole("heading", { level: 1, name: "Panel" })).toBeVisible();
      await expect(
        second.getByRole("region", { name: "Mağazanızı 3 addımda hazırlayın" }),
      ).toHaveCount(0);
      await other.close();
    }
  });

  test("each cabinet screen has one primary action", async ({ page }) => {
    await signIn(page);
    for (const path of ["/az/merchant", "/az/merchant/products"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("main").getByRole("link", { name: "Yeni məhsul" })).toHaveCount(
        1,
      );
    }
  });
});
