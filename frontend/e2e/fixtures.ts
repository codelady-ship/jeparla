import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Locator, type Page } from "@playwright/test";

/**
 * Every test fails on a console error, an uncaught page error or a 5xx response
 * (issue #28). 404s of planned pages are not errors here; links are checked separately.
 */
/** Call at the start of a test that opens a missing page on purpose. */
export const allowNotFound = () => test.info().annotations.push({ type: "allow-404" });

export const test = base.extend<{ guard: void }>({
  guard: [
    async ({ page }, use, info) => {
      const problems: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        // A test that opens a missing page on purpose expects the browser's 404 log line.
        if (
          info.annotations.some((a) => a.type === "allow-404") &&
          /status of 404/.test(msg.text())
        )
          return;
        problems.push(`console: ${msg.text()}`);
      });
      page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
      page.on("response", (res) => {
        if (res.status() >= 500) problems.push(`${res.status()} ${res.url()}`);
      });
      await use();
      expect(problems, "console errors, page errors or 5xx responses").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/**
 * Waits until React has hydrated this element (it carries React's props key). `goto`
 * resolves on `load`, which can come before hydration on a slow CI runner; a click or
 * select before that does nothing.
 */
export async function waitForHydration(locator: Locator) {
  await expect
    .poll(() => locator.evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps"))))
    .toBe(true);
}

export const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768;

/** WCAG 2.1 A/AA through axe; the plan requires zero violations (Lighthouse a11y = 100). */
export async function expectNoA11yViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const summary = violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );
  expect(summary, "axe violations").toEqual([]);
}

/** A fresh random password that meets the rules; never a real credential. */
export function testPassword() {
  return `e2e${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}7`;
}
