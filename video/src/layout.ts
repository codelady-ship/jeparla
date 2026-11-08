// Scene space: the 1280x720 AI walk-in clip (source/walk.mp4). Figure boxes are
// measured on its last frame (scratchpad split2.cjs on the cut-out frame 120).
export const SOURCE = { w: 1280, h: 720 };

/** Act 1: cut-out frames of the clip (public/walk/NNN.webp), 24 fps. */
export const WALK_FRAMES = 121;
export const WALK_FPS = 24;
/** Played a little faster than real time, so the entrance stays short. */
export const WALK_SPEED = 1.15;

// White tiger, golden tiger, black panther as they stand in the last frame.
export const TIGERS = [
  { left: 209, top: 105, width: 239, height: 580 },
  { left: 524, top: 18, width: 273, height: 676 },
  { left: 908, top: 101, width: 266, height: 593 },
];

// The models stand as one group on the same floor line, a little taller than the
// animals (real proportions), each centred near her animal. All three photos share
// one scale (0.78 of the trimmed cut-outs in public/model-N.png).
export const MODELS = [
  { left: 314, top: -175, width: 232, height: 869 },
  { left: 541, top: -175, width: 238, height: 869 },
  { left: 783, top: -227, width: 224, height: 921 },
];

/** Horizontal extent of all figures, and the floor line, in scene space. */
export const GROUP = { left: 209, right: 1174, floor: 694 };

/** Site cream (docs/design/tokens.json, scene ivory). */
export const BACKDROP = "#F7F3EA";
export const GOLD = "#C5A15A";
/** Site dark green (scene green), used for the shadow-like brand word. */
export const INK = "#16251F";
export const GOLD_LIGHT = "#E8D39A";

export const FPS = 30;
/** Frames until the last clip frame is reached (scene frame -> clip frame). */
const WALK_END = Math.ceil((WALK_FRAMES - 1) / ((WALK_FPS / FPS) * WALK_SPEED));
/** Act 1: the animals walk in (autoplay); a short hold after they stop. */
export const ENTER = WALK_END + 6;
/** Act 2: light sweep turns each animal into a model (scroll-scrubbed). */
export const TRANSFORM = 72;

/** Clip frame shown at scene frame `frame` (act 1). */
export function walkFrame(frame: number) {
  return Math.min(WALK_FRAMES - 1, Math.floor(frame * (WALK_FPS / FPS) * WALK_SPEED));
}

export type Format = { width: number; height: number; scale: number; x: number; y: number };

/**
 * Places the scene in a composition: the figures take `figureShare` of the width,
 * centred at `centerX`, and stand a little above the bottom edge.
 */
export function format(width: number, height: number, figureShare: number, centerX = 0.5): Format {
  const span = GROUP.right - GROUP.left;
  const scale = (width * figureShare) / span;
  const x = width * centerX - (GROUP.left + span / 2) * scale;
  const y = height - (GROUP.floor + 10) * scale;
  return { width, height, scale, x, y };
}

/** Desktop: figures sit right of center so the copy has the left third; small enough
 * that the models keep headroom when wide screens crop the top (video is bottom-anchored). */
export const DESKTOP = format(1920, 1080, 0.4, 0.63);
/** Phone: narrow enough that cover-cropping on tall phones (19.5:9) keeps the outer animals. */
export const MOBILE = format(1080, 1920, 0.82);
