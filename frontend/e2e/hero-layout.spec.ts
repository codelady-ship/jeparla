import { HERO_DESKTOP_QUERY, HERO_FIGURES } from "../src/components/home/hero/hero-media";
import { expect, test } from "./fixtures";

/**
 * Home hero layout on phones, tablets and landscape phones (#160, owner feedback):
 * the headline and both calls to action never lie over the figures, the calls to
 * action are at least 44px tall, and the page never scrolls sideways. The figure box
 * is computed from the rendered frame (object-fit and object-position) and the
 * measured figure area of the footage (HERO_FIGURES).
 */
const SIZES = [
  [320, 568],
  [339, 642],
  [360, 640],
  [390, 844],
  [430, 932],
  [768, 1024],
  [834, 1112],
  [844, 390],
  [1024, 768],
  [1440, 900],
] as const;

type Box = { left: number; top: number; right: number; bottom: number };

test("hero copy and calls to action stay clear of the figures", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "sizes are set in the test");
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    await page.goto("/az");
    const frames = page.locator("img.hero-frames");
    await expect
      .poll(() => frames.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
      .toBeGreaterThan(0);

    const result = await page.evaluate(
      ({ query, figures }) => {
        const img = document.querySelector<HTMLImageElement>("img.hero-frames")!;
        const hero = img.closest(".hero")!.getBoundingClientRect();
        const r = img.getBoundingClientRect();
        const style = getComputedStyle(img);
        const fit = style.objectFit === "cover" ? Math.max : Math.min;
        const scale = fit(r.width / img.naturalWidth, r.height / img.naturalHeight);
        const w = img.naturalWidth * scale;
        const h = img.naturalHeight * scale;
        const [px, py] = style.objectPosition.split(" ").map((v) => parseFloat(v) / 100);
        const x = r.left + (r.width - w) * px;
        const y = r.top + (r.height - h) * py;
        const f = matchMedia(query).matches ? figures.desktop : figures.mobile;
        const figure: Box = {
          left: Math.max(x + w * f.left, hero.left),
          right: Math.min(x + w * f.right, hero.right),
          top: Math.max(y + h * f.top, hero.top),
          bottom: Math.min(y + h, hero.bottom),
        };
        const box = (el: Element) => {
          const b = el.getBoundingClientRect();
          return {
            name: (el as HTMLElement).innerText.trim().slice(0, 30),
            left: b.left,
            right: b.right,
            top: b.top,
            bottom: b.bottom,
          };
        };
        const copy = [...document.querySelectorAll(".hero h1, .hero-ctas a")].map(box);
        return {
          figure,
          copy,
          ctaHeights: [...document.querySelectorAll(".hero-ctas a")].map(
            (a) => a.getBoundingClientRect().height,
          ),
          overflow: document.documentElement.scrollWidth - innerWidth,
          heroBottom: hero.bottom,
        };
      },
      { query: HERO_DESKTOP_QUERY, figures: HERO_FIGURES },
    );

    const at = `${width}x${height}`;
    const hits = result.copy.filter(
      (c) =>
        c.left < result.figure.right &&
        c.right > result.figure.left &&
        c.top < result.figure.bottom &&
        c.bottom > result.figure.top,
    );
    expect(
      hits.map((c) => c.name),
      `copy over the figures at ${at}`,
    ).toEqual([]);
    for (const c of result.copy)
      expect(c.bottom, `"${c.name}" inside the hero at ${at}`).toBeLessThanOrEqual(
        result.heroBottom,
      );
    for (const h of result.ctaHeights)
      expect(h, `call to action height at ${at}`).toBeGreaterThanOrEqual(44);
    expect(result.overflow, `horizontal overflow at ${at}`).toBeLessThanOrEqual(0);
  }
});
