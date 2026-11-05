import { Timeline } from "@/lib/motion/scrub";

/** Scroll length of the sticky hero, in viewport heights (also in globals.css). */
export const HERO_SCROLL = { desktop: 2.6, mobile: 3.6 } as const;

function parts(root: HTMLElement) {
  const all = (sel: string) => Array.from(root.querySelectorAll<HTMLElement>(sel));
  const one = (p: HTMLElement, sel: string) => p.querySelector<HTMLElement>(sel)!;
  return {
    panels: all("[data-hero-panel]"),
    cat: (p: HTMLElement) => one(p, "[data-hero-cat]"),
    dim: (p: HTMLElement) => one(p, "[data-hero-dim]"),
    copy: (key: string) => root.querySelector<HTMLElement>(`[data-hero-copy="${key}"]`)!,
    captions: all("[data-hero-caption]"),
    hint: all("[data-hero-hint]"),
  };
}

/** Headline swap: the old line leaves upward while the new one rises in. */
function swap(tl: Timeline, from: HTMLElement, to: HTMLElement, at: number) {
  tl.to(from, { alpha: 0, y: -24 }, at, 0.4).fromTo(
    to,
    { alpha: 0, y: 24 },
    { alpha: 1, y: 0 },
    at + 0.3,
    0.4,
  );
}

/**
 * Gold light sweep across one panel; the model is uncovered right behind it.
 * Outer and inner layers move in opposite directions, so only transforms animate.
 */
function reveal(tl: Timeline, panel: HTMLElement, at: number) {
  const sweep = panel.querySelector<HTMLElement>("[data-hero-sweep]")!;
  const model = panel.querySelector<HTMLElement>("[data-hero-model]")!;
  const inner = panel.querySelector<HTMLElement>("[data-hero-model-inner]")!;
  tl.fromTo(sweep, { xPercent: -100, alpha: 1 }, { xPercent: 300, alpha: 1 }, at, 0.9)
    .fromTo(model, { xPercent: -101 }, { xPercent: 0 }, at + 0.05, 0.8)
    .fromTo(inner, { xPercent: 101 }, { xPercent: 0 }, at + 0.05, 0.8)
    .to(sweep, { alpha: 0 }, at + 0.9, 0.1);
}

/**
 * Desktop: the three panels stand side by side. Gold steps forward, then silver
 * and diamond, then a light sweep turns each animal into its model and the
 * jewelry links appear.
 */
export function desktopTimeline(root: HTMLElement) {
  const p = parts(root);
  const [silver, diamond, gold] = p.panels;
  const tl = new Timeline();

  tl.to(p.hint, { alpha: 0 }, 0, 0.2);
  tl.to([p.dim(silver), p.dim(diamond)], { opacity: 0.65 }, 0, 0.6).to(
    p.cat(gold),
    { scale: 1.06 },
    0,
    1,
  );
  swap(tl, p.copy("intro"), p.copy("gold"), 0.1);

  tl.to([p.dim(silver), p.dim(diamond)], { opacity: 0 }, 1, 0.6)
    .to(p.dim(gold), { opacity: 0.65 }, 1, 0.6)
    .to(p.cat(gold), { scale: 1 }, 1, 0.6)
    .to([p.cat(silver), p.cat(diamond)], { scale: 1.06 }, 1, 1);
  swap(tl, p.copy("gold"), p.copy("shine"), 1.1);

  tl.to(p.dim(gold), { opacity: 0 }, 2, 0.4).to(
    [p.cat(silver), p.cat(diamond)],
    { scale: 1 },
    2,
    0.4,
  );
  p.panels.forEach((panel, i) => reveal(tl, panel, 2.1 + i * 0.35));
  swap(tl, p.copy("shine"), p.copy("final"), 3.1);
  tl.fromTo(p.captions, { alpha: 0, y: 16 }, { alpha: 1, y: 0 }, 3.3, 0.4, 0.12);
  return tl;
}

/**
 * Phone: one animal fills the screen at a time. The tiger enters from the
 * right, the snow leopard from the center, then all three shrink into a row
 * while the light sweep turns them into the three models.
 */
export function mobileTimeline(root: HTMLElement) {
  const p = parts(root);
  const [silver, diamond, gold] = p.panels;
  const tl = new Timeline();

  tl.fromTo(gold, { xPercent: 100, alpha: 1 }, { xPercent: 0, alpha: 1 }, 0, 1);
  swap(tl, p.copy("intro"), p.copy("gold"), 0.2);

  tl.fromTo(diamond, { alpha: 0, scale: 1.15 }, { alpha: 1, scale: 1 }, 1.1, 1);
  swap(tl, p.copy("gold"), p.copy("shine"), 1.2);

  // Into a row of three: each card is 30% wide, centered at 1/6, 1/2 and 5/6.
  const row = { scale: 0.3, yPercent: -14, radius: 40 };
  tl.to(silver, { ...row, xPercent: -34 }, 2.2, 1)
    .to(diamond, { ...row, xPercent: 0 }, 2.2, 1)
    .to(gold, { ...row, xPercent: 34 }, 2.2, 1);
  [silver, diamond, gold].forEach((panel, i) => reveal(tl, panel, 2.4 + i * 0.3));
  swap(tl, p.copy("shine"), p.copy("final"), 3.1);
  return tl;
}
