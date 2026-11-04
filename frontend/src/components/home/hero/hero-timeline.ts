import type { gsap as Gsap } from "gsap";

type G = typeof Gsap;
type Timeline = ReturnType<G["timeline"]>;

/** Scroll distance of the pinned hero, in viewport heights. */
export const HERO_SCROLL = { desktop: 2.6, mobile: 3.6 } as const;

function parts(root: HTMLElement) {
  const q = <T extends Element = HTMLElement>(sel: string) =>
    Array.from(root.querySelectorAll<T & HTMLElement>(sel));
  const panels = q("[data-hero-panel]");
  const one = (p: HTMLElement, sel: string) => p.querySelector<HTMLElement>(sel)!;
  return {
    panels,
    cat: (p: HTMLElement) => one(p, "[data-hero-cat]"),
    dim: (p: HTMLElement) => one(p, "[data-hero-dim]"),
    copy: (key: string) => root.querySelector<HTMLElement>(`[data-hero-copy="${key}"]`)!,
    captions: q("[data-hero-caption]"),
    hint: q("[data-hero-hint]"),
  };
}

function pinned(gsap: G, root: HTMLElement, screens: number): Timeline {
  return gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: root,
      start: "top top",
      end: () => `+=${window.innerHeight * screens}`,
      pin: true,
      // <main> is a flex column, where ScrollTrigger would skip the spacer by default.
      pinSpacing: true,
      scrub: 0.6,
      invalidateOnRefresh: true,
    },
  });
}

/** Headline swap: the old line leaves upward while the new one rises in. */
function swap(tl: Timeline, from: HTMLElement, to: HTMLElement, at: number) {
  tl.to(from, { autoAlpha: 0, y: -24, duration: 0.4 }, at).fromTo(
    to,
    { autoAlpha: 0, y: 24 },
    { autoAlpha: 1, y: 0, duration: 0.4 },
    at + 0.3,
  );
}

/**
 * Gold light sweep across one panel; the model is uncovered right behind it.
 * Outer and inner layers move in opposite directions, so only transforms animate.
 * x: 0 clears the CSS start offset, which GSAP would otherwise read as pixels.
 */
function reveal(tl: Timeline, panel: HTMLElement, at: number) {
  const sweep = panel.querySelector("[data-hero-sweep]");
  const model = panel.querySelector("[data-hero-model]");
  const inner = panel.querySelector("[data-hero-model-inner]");
  tl.fromTo(sweep, { xPercent: -100, autoAlpha: 1 }, { xPercent: 300, duration: 0.9 }, at)
    .fromTo(model, { x: 0, xPercent: -101 }, { xPercent: 0, duration: 0.8 }, at + 0.05)
    .fromTo(inner, { x: 0, xPercent: 101 }, { xPercent: 0, duration: 0.8 }, at + 0.05)
    .to(sweep, { autoAlpha: 0, duration: 0.1 }, at + 0.9);
}

/**
 * Desktop: the three panels stand side by side. Gold steps forward, then silver
 * and diamond, then a light sweep turns each animal into its model and the
 * jewelry links appear.
 */
export function desktopTimeline(gsap: G, root: HTMLElement) {
  const p = parts(root);
  const [silver, diamond, gold] = p.panels;
  const tl = pinned(gsap, root, HERO_SCROLL.desktop);

  tl.to(p.hint, { autoAlpha: 0, duration: 0.2 }, 0);
  tl.to([p.dim(silver), p.dim(diamond)], { opacity: 0.65, duration: 0.6 }, 0).to(
    p.cat(gold),
    { scale: 1.06, duration: 1 },
    0,
  );
  swap(tl, p.copy("intro"), p.copy("gold"), 0.1);

  tl.to([p.dim(silver), p.dim(diamond)], { opacity: 0, duration: 0.6 }, 1)
    .to(p.dim(gold), { opacity: 0.65, duration: 0.6 }, 1)
    .to(p.cat(gold), { scale: 1, duration: 0.6 }, 1)
    .to([p.cat(silver), p.cat(diamond)], { scale: 1.06, duration: 1 }, 1);
  swap(tl, p.copy("gold"), p.copy("shine"), 1.1);

  tl.to(p.dim(gold), { opacity: 0, duration: 0.4 }, 2).to(
    [p.cat(silver), p.cat(diamond)],
    { scale: 1, duration: 0.4 },
    2,
  );
  p.panels.forEach((panel, i) => reveal(tl, panel, 2.1 + i * 0.35));
  swap(tl, p.copy("shine"), p.copy("final"), 3.1);
  tl.fromTo(
    p.captions,
    { autoAlpha: 0, y: 16 },
    { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.12 },
    3.3,
  );
  return tl;
}

/**
 * Phone: one animal fills the screen at a time. The tiger enters from the
 * right, the snow leopard from the center, then all three shrink into a row
 * while the light sweep turns them into the three models.
 */
export function mobileTimeline(gsap: G, root: HTMLElement) {
  const p = parts(root);
  const [silver, diamond, gold] = p.panels;
  const tl = pinned(gsap, root, HERO_SCROLL.mobile);

  tl.fromTo(gold, { xPercent: 100, autoAlpha: 1 }, { xPercent: 0, duration: 1 }, 0);
  swap(tl, p.copy("intro"), p.copy("gold"), 0.2);

  tl.fromTo(diamond, { autoAlpha: 0, scale: 1.15 }, { autoAlpha: 1, scale: 1, duration: 1 }, 1.1);
  swap(tl, p.copy("gold"), p.copy("shine"), 1.2);

  // Into a row of three: each card is 30% wide, centered at 1/6, 1/2 and 5/6.
  const row = { scale: 0.3, yPercent: -14, borderRadius: 40, duration: 1 };
  tl.to(silver, { ...row, xPercent: -34 }, 2.2)
    .to(diamond, { ...row, xPercent: 0 }, 2.2)
    .to(gold, { ...row, xPercent: 34 }, 2.2);
  [silver, diamond, gold].forEach((panel, i) => reveal(tl, panel, 2.4 + i * 0.3));
  swap(tl, p.copy("shine"), p.copy("final"), 3.1);
  return tl;
}
