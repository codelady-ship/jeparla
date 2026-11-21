import { expect, test } from "./fixtures";

/**
 * Home page scroll motion and the checks section (#287): the three checks sit side by
 * side on wide screens; content that comes in on scroll is shown once it is reached,
 * and nothing is hidden without JavaScript.
 */
test("the three checks sit in one row on wide screens", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "a wide-screen layout");
  await page.goto("/az");
  const checks = page.locator("[data-checks] > li");
  await expect(checks).toHaveCount(3);
  await checks.first().scrollIntoViewIfNeeded();
  const tops = await checks.evaluateAll((els) =>
    els.map((el) => Math.round(el.getBoundingClientRect().top)),
  );
  expect(new Set(tops).size, `check tops ${tops.join(", ")}`).toBe(1);
});

test.describe("with motion allowed", () => {
  test.use({ reducedMotion: "no-preference" });

  test("sections below the hero come in when scrolled to", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "one viewport is enough");
    await page.goto("/az");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "");
    const checks = page.locator("[data-checks]");
    await expect(checks).toHaveAttribute("data-reveal", "hidden");
    // Sections above take their real height as they render (content-visibility), so the
    // first scroll can land short: scroll again until the list has been reached.
    await expect(async () => {
      await checks.scrollIntoViewIfNeeded();
      await expect(checks).toHaveAttribute("data-reveal", "shown", { timeout: 1000 });
    }).toPass();
    await expect
      .poll(() =>
        checks
          .locator("li")
          .last()
          .evaluate((el) => Number(getComputedStyle(el).opacity)),
      )
      .toBe(1);
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false, reducedMotion: "no-preference" });

  test("everything below the hero is visible", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "one viewport is enough");
    await page.goto("/az");
    const hidden = await page.evaluate(
      () =>
        [...document.querySelectorAll("[data-reveal], [data-reveal-item]")].filter(
          (el) => getComputedStyle(el).opacity !== "1",
        ).length,
    );
    expect(hidden).toBe(0);
  });
});
