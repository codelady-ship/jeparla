import { expect, expectNoA11yViolations, test } from "./fixtures";

/**
 * Film sections with the film pinned behind the content (#292): while the copy and the
 * cards scroll over it, the film layer stays at the top of the viewport (under the sticky
 * header at most); at the end the next section covers it; axe passes over the film.
 */
const SECTIONS = ["home-verified", "home-stores", "home-seller"] as const;

for (const id of SECTIONS) {
  test(`the ${id} film stays pinned while the content scrolls over it`, async ({ page }) => {
    await page.goto("/az");
    const section = page.locator(`[data-sticky-film]:has(#${id})`);
    await expect(section).toHaveCount(1);
    const stage = section.locator("[data-sticky-film-stage]");
    const heading = page.locator(`#${id}`);

    // The sections use content-visibility (#286): until one is near the viewport it has
    // its placeholder height, so bring it in first and measure again before every step.
    await section.scrollIntoViewIfNeeded();
    const settle = () =>
      page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      );
    const measure = () =>
      section.evaluate((el) => {
        const box = el.getBoundingClientRect();
        return { top: box.top + window.scrollY, height: box.height, viewport: window.innerHeight };
      });
    await settle();
    const headerHeight = await page
      .locator("header")
      .first()
      .evaluate((el) => el.getBoundingClientRect().height);
    // The pinned stretch: from the section top at the viewport top until the section
    // bottom reaches the viewport bottom (the last screen is the next section covering it).
    let geometry = await measure();
    expect(
      geometry.height - geometry.viewport,
      "the section is taller than one screen",
    ).toBeGreaterThan(0);

    const headingTops: number[] = [];
    for (const share of [0, 0.3, 0.6, 1]) {
      // Twice: sections above may take their real height once they come near.
      for (let pass = 0; pass < 2; pass++) {
        geometry = await measure();
        const travel = geometry.height - geometry.viewport;
        await page.evaluate(
          (y) => window.scrollTo({ top: y, behavior: "instant" }),
          Math.round(geometry.top + travel * share),
        );
        await settle();
      }
      const stageTop = await stage.evaluate((el) => el.getBoundingClientRect().top);
      expect(stageTop, `film top at ${share} of the stretch`).toBeGreaterThanOrEqual(-1);
      expect(stageTop, `film top at ${share} of the stretch`).toBeLessThanOrEqual(headerHeight + 1);
      headingTops.push(await heading.evaluate((el) => el.getBoundingClientRect().top));
    }
    // The copy moved up over the film while the film stayed put.
    expect(headingTops[0] - headingTops[2]).toBeGreaterThan(geometry.viewport / 4);

    // At the end of the stretch the next section has scrolled over the film and covers it.
    const covered = await section.evaluate((el) => {
      const next = el.nextElementSibling;
      const hit = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
      return !!next && !!hit && next.contains(hit);
    });
    expect(covered, "the next section covers the film").toBe(true);
  });
}

test("axe passes with the content over a pinned film", async ({ page }) => {
  await page.goto("/az");
  const section = page.locator("[data-sticky-film]:has(#home-verified)");
  await section.evaluate((el) => {
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + window.innerHeight * 0.6, behavior: "instant" });
  });
  await expect(page.locator("#home-verified")).toBeVisible();
  await expectNoA11yViolations(page);
});

test("no horizontal overflow on the film sections", async ({ page }) => {
  await page.goto("/az");
  for (const id of SECTIONS) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow near ${id}`).toBeLessThanOrEqual(0);
  }
});
