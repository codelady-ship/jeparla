import { WORDMARK } from "./logo-paths";

/**
 * Timing of the handwritten wordmark, shared by the site hero and the Remotion hero scene
 * (video/src/Hero.tsx): the letters are written one after another (owner, 2026-11-22: "hərf
 * hərf"), each behind its own soft pen, at an even pen speed (a wide letter takes longer).
 */

/** Soft edge of the pen, in wordmark units: the reveal fades over it, like wet ink. */
export const PEN_FEATHER = 14;
/** Extra outline that thickens the thin script into a bold stroke (owner: "qalın şriftlə"). */
export const PEN_BOLD = 4;
/** Share of the letter phase a letter overlaps the next one, so the hand keeps moving. */
const OVERLAP = 0.25;

export type LetterWindow = {
  d: string;
  x0: number;
  /** Width the pen travels: the letter plus its feather. */
  travel: number;
  /** Start and length of this letter within the letter phase (0 to 1). */
  start: number;
  span: number;
};

export const LETTERS: LetterWindow[] = (() => {
  const widths = WORDMARK.glyphs.map((g) => g.x1 - g.x0);
  const total = widths.reduce((a, b) => a + b, 0);
  let at = 0;
  const raw = WORDMARK.glyphs.map((g, i) => {
    const share = widths[i] / total;
    const start = at * (1 - OVERLAP);
    at += share;
    return { d: g.d, x0: g.x0, travel: widths[i] + PEN_FEATHER, start, span: share };
  });
  // Stretch so the last letter ends exactly when the phase does.
  const end = Math.max(...raw.map((l) => l.start + l.span));
  return raw.map((l) => ({ ...l, start: l.start / end, span: l.span / end }));
})();

/** Progress of one letter (0 to 1) when the letter phase is at `p` (0 to 1). */
export function letterProgress(l: LetterWindow, p: number) {
  return Math.min(1, Math.max(0, (p - l.start) / l.span));
}
