/**
 * Hero scene assets, rendered from the Remotion project in /video
 * (`cd video && sh scripts/export.sh`). Act 1 is a short video (three tigers
 * walk in and stop); act 2 is a frame sequence that scroll scrubs (a gold light
 * sweep turns each tiger into a model). Both share one backdrop colour.
 */
export const HERO_MEDIA = {
  desktop: { video: "/hero/enter-desktop.mp4", frames: "/hero/tf-desktop" },
  mobile: { video: "/hero/enter-mobile.mp4", frames: "/hero/tf-mobile" },
} as const;

/**
 * Poster of the entrance video: its first frame, which is the plain backdrop in
 * both cuts (about 0.5 KB, lossless AVIF). Painted with the page, it keeps the video
 * from becoming the LCP element when its first frame arrives (#160); the headline
 * is the largest content of the first screen.
 */
export const HERO_POSTER = "/hero/poster.avif";

/** Number of act 2 frames per format (00.jpg ... 37.jpg). */
export const HERO_FRAMES = 37;

/** Media query that picks the desktop (16:9) cut; the phone cut is 9:16. */
export const HERO_DESKTOP_QUERY = "(min-aspect-ratio: 4/5)";

export const frameUrl = (dir: string, i: number) => `${dir}/${String(i).padStart(2, "0")}.jpg`;

/**
 * Scroll phases, as fractions of the sticky track (0 = hero at the top, 1 = released):
 * the scroll hint leaves first, then the light sweep plays. (The "Jeparla" word
 * is part of the entrance video and is gone by its last frame.)
 */
export const HERO_PHASES = {
  hintOut: [0, 0.1],
  transform: [0.03, 0.42],
  /** The brand line above the headline arrives with the models. */
  brandIn: [0.22, 0.4],
  /** The scene rail (01, 02, 03) fades in once the models stand. */
  scenesIn: [0.4, 0.46],
  /** Scene 1, 2, 3: the camera rests on one model each; the rail fills per scene. */
  scenes: [
    [0.46, 0.62],
    [0.62, 0.78],
    [0.78, 0.94],
  ],
} as const;

/** The three models, left to right in both cuts. Keys name the jewelry each one wears. */
export const HERO_SCENES = ["diamond", "gold", "silver"] as const;

/**
 * Horizontal centre of each model, as a fraction of the footage width (measured on
 * the last transformation frame of each cut), in HERO_SCENES order.
 */
export const HERO_MODELS = {
  mobile: [0.24, 0.5, 0.76],
  desktop: [0.51, 0.64, 0.77],
} as const;

/** Largest camera zoom per cut; the measured space above the heads may lower it. */
export const HERO_ZOOM = { mobile: 1.6, desktop: 1.35 } as const;

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Camera over the scrubbed track: wide while the tigers turn, then it pushes in on
 * model 1, pans to 2 and 3 and pulls back to the group at the end. Returns the zoom
 * amount (0 = wide, 1 = full) and the focus point as a fraction of footage width.
 */
export function heroCamera(p: number, models: readonly number[]) {
  const [a, b, c] = models;
  const zoom =
    p < 0.44
      ? 0
      : p < 0.52
        ? smooth(phase(p, [0.44, 0.52]))
        : p < 0.92
          ? 1
          : 1 - smooth(phase(p, [0.92, 1]));
  let focus = a;
  if (p >= 0.6) focus = a + (b - a) * smooth(phase(p, [0.6, 0.68]));
  if (p >= 0.76) focus = b + (c - b) * smooth(phase(p, [0.76, 0.84]));
  return { zoom, focus };
}

/**
 * Where the figures stand in each cut, as fractions of the footage (measured on the
 * exported frames: tigers, the "Jeparla" shadow word and the models). globals.css
 * sizes the phone stage from `mobile.top` (0.43 = 1 - top + a little air), and the
 * e2e check keeps the copy and the calls to action off this box.
 */
export const HERO_FIGURES = {
  mobile: { top: 0.59, left: 0.08, right: 0.97 },
  desktop: { top: 0.34, left: 0.42, right: 0.84 },
} as const;

/** Maps p into [from, to] -> 0..1, clamped. */
export function phase(p: number, [from, to]: readonly [number, number]) {
  return Math.min(Math.max((p - from) / (to - from), 0), 1);
}
