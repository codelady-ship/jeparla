import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * Touch targets on phones (#136, #148): every control a finger aims at is at least
 * 44x44px, either itself or through an invisible hit area (`touch-target`). Measured
 * the way a finger meets it: from the centre outwards, which points still land on the
 * control (elementFromPoint), so a ::after hit area counts and a covered one does not.
 */
const MIN = 44;
const RING = "/az/products/toy-uzukleri-silver-925-2";
const STORE = "/az/stores/ayzer-zerger";

type Hit = { name: string; width: number; height: number };

/** Hit area of each element, centred in the viewport first. Caps at 81px per axis. */
function measure(elements: Element[]): Hit[] {
  return elements.map((el) => {
    el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const lands = (x: number, y: number) => {
      const t = document.elementFromPoint(x, y);
      return t !== null && (t === el || el.contains(t));
    };
    const reach = (dx: number, dy: number) => {
      let d = 0;
      while (d < 40 && lands(cx + dx * (d + 1), cy + dy * (d + 1))) d++;
      return d;
    };
    const name = (
      el.getAttribute("aria-label") ||
      (el as HTMLElement).innerText ||
      el.getAttribute("name") ||
      el.tagName
    )
      .trim()
      .slice(0, 40);
    return {
      name: `${el.tagName.toLowerCase()} "${name}"`,
      width: reach(-1, 0) + reach(1, 0) + 1,
      height: reach(0, -1) + reach(0, 1) + 1,
    };
  });
}

/**
 * Waits for streamed content and its view transition to finish: while a view
 * transition runs, every point hit-tests to the document element.
 */
async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => !document.documentElement.matches(":active-view-transition"));
}

async function hitAreas(locator: Locator) {
  await expect(locator.first()).toBeAttached();
  await settle(locator.page());
  return locator.evaluateAll(measure);
}

async function expectTouchSized(locator: Locator, expected: number) {
  const hits = await hitAreas(locator);
  expect(hits, `${locator}`).toHaveLength(expected);
  const small = hits.filter((h) => h.width < MIN || h.height < MIN);
  expect(small, "controls under 44x44px").toEqual([]);
}

/**
 * All visible controls of a page except inline text links (WCAG 2.5.5 exception) and
 * controls that are visually hidden until focused (skip link).
 */
async function sweep(page: Page) {
  await settle(page);
  // The header slides away on scroll down; back at the top it returns (DOM order
  // measures it first, then the page top to bottom).
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(page.getByRole("link", { name: "Jeparla", exact: true })).toBeInViewport({
    ratio: 1,
  });
  await page.waitForTimeout(400);
  const count = await page.evaluate(() => {
    const controls = [
      ...document.querySelectorAll<HTMLElement>(
        "a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [tabindex='0']",
      ),
    ].filter((el) => {
      const style = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1 || style.visibility === "hidden") return false;
      if (el.closest("[aria-hidden=true], [inert], .pwa-card")) return false;
      // Links inside running text keep the text's line height (WCAG exception).
      if (el.tagName === "A" && style.display === "inline") return false;
      // Radios and checkboxes are sized by their label.
      if (el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox"))
        return false;
      return true;
    });
    controls.forEach((el) => el.setAttribute("data-sweep", ""));
    return controls.length;
  });
  expect(count).toBeGreaterThan(0);
  const hits = await page.locator("[data-sweep]").evaluateAll(measure);
  return hits.filter((h) => h.width < MIN || h.height < MIN);
}

for (const width of [360, 390, 430]) {
  test.describe(`touch targets at ${width}px (coarse pointer)`, () => {
    test.use({ viewport: { width, height: 844 }, hasTouch: true });
    test.beforeEach(async ({ page }) => {
      test.skip(
        test.info().project.name !== "mobile",
        "touch widths run once, in the phone project",
      );
      await page.goto("/az");
      expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
    });

    test("home: logo, Hamısına bax, metal price table", async ({ page }) => {
      await expectTouchSized(page.getByRole("link", { name: "Jeparla", exact: true }), 1);
      await expectTouchSized(page.getByRole("link", { name: "Hamısına bax" }), 3);
      await expectTouchSized(page.locator("summary", { hasText: "Cədvəl kimi göstər" }), 1);
      expect(await sweep(page), "small controls on the home page").toEqual([]);
    });

    test("stores: search form", async ({ page }) => {
      await page.goto("/az/stores");
      await expectTouchSized(page.getByRole("searchbox", { name: "Mağaza adı" }), 1);
      await expectTouchSized(page.getByRole("combobox", { name: "Şəhər" }), 1);
      await expectTouchSized(page.getByRole("button", { name: "Axtar", exact: true }), 1);
      expect(await sweep(page), "small controls on the stores page").toEqual([]);
    });

    test("store page: WhatsApp, phone and product search", async ({ page }) => {
      await page.goto(STORE);
      await expectTouchSized(page.getByRole("link", { name: "WhatsApp ilə yaz" }), 1);
      await expectTouchSized(page.locator('a[href^="tel:"]'), 1);
      await expectTouchSized(page.getByRole("searchbox", { name: "Mağazada axtar" }), 1);
      await expectTouchSized(page.getByRole("combobox", { name: "Kateqoriya" }), 1);
      await expectTouchSized(page.getByRole("button", { name: "Axtar", exact: true }), 1);
      expect(await sweep(page), "small controls on the store page").toEqual([]);
    });

    test("product page: photo zoom and metal price table", async ({ page }) => {
      await page.goto(RING);
      await expectTouchSized(page.getByRole("button", { name: "Şəkli böyüt" }), 1);
      await expectTouchSized(page.locator("summary", { hasText: "Cədvəl kimi göstər" }), 1);
      expect(await sweep(page), "small controls on the product page").toEqual([]);
    });
  });
}

test("desktop keeps its compact controls", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop", "the desktop look");
  await page.goto(STORE);
  const height = (l: Locator) => l.evaluate((el) => el.getBoundingClientRect().height);
  expect(await height(page.getByRole("link", { name: "WhatsApp ilə yaz" }))).toBe(40);
  expect(await height(page.getByRole("button", { name: "Axtar", exact: true }))).toBe(40);
  expect(await height(page.getByRole("searchbox", { name: "Mağazada axtar" }))).toBe(40);
});
