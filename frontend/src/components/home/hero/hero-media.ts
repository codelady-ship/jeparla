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
  hintOut: [0, 0.18],
  transform: [0.06, 0.82],
  /** The brand line above the headline arrives with the models. */
  brandIn: [0.42, 0.78],
} as const;

/** Maps p into [from, to] -> 0..1, clamped. */
export function phase(p: number, [from, to]: readonly [number, number]) {
  return Math.min(Math.max((p - from) / (to - from), 0), 1);
}
