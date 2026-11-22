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

/**
 * Act 2 models: knee-up studio portraits (public/model-N.png, 832x1248 cut-outs whose
 * bottom edge is the crop line). They are not placed in scene space: the group stands
 * close together, cropped by the bottom of the frame, sized by `Format.modelHeight`.
 */
export const MODEL_SOURCE = { w: 832, h: 1248 };
/** Centre of each model relative to the group centre, in model heights (overlapping shoulders). */
export const MODEL_OFFSETS = [-0.35, 0, 0.35];
/** Paint order: the outer models first, the centre one in front. */
export const MODEL_ORDER = [0, 2, 1];

/** Horizontal extent of all figures, and the floor line, in scene space. */
export const GROUP = { left: 209, right: 1174, floor: 694 };

/** Site cream (docs/design/tokens.json, scene ivory). */
export const BACKDROP = "#F7F3EA";
export const GOLD = "#C5A15A";
/** Site dark green (scene green), used for the shadow-like brand word. */
export const INK = "#16251F";
export const GOLD_LIGHT = "#E8D39A";
/** Scene gold deep: the far half of the ring on the wordmark. */
export const GOLD_DEEP = "#8C6A26";

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

export type Format = {
  width: number;
  height: number;
  scale: number;
  x: number;
  y: number;
  /** Act 2: height of one model photo in px, and the group centre. */
  modelHeight: number;
  modelCenterX: number;
};

/**
 * Places the scene in a composition: the animals take `figureShare` of the width,
 * centred at `centerX`, and stand a little above the bottom edge. The models are
 * `modelShare` of the frame height, cropped by its bottom edge.
 */
export function format(
  width: number,
  height: number,
  figureShare: number,
  modelShare: number,
  centerX = 0.5,
): Format {
  const span = GROUP.right - GROUP.left;
  const scale = (width * figureShare) / span;
  const x = width * centerX - (GROUP.left + span / 2) * scale;
  const y = height - (GROUP.floor + 10) * scale;
  return { width, height, scale, x, y, modelHeight: height * modelShare, modelCenterX: width * centerX };
}

/** Box of model `i` in composition px. */
export function modelBox(f: Format, i: number) {
  const height = f.modelHeight;
  const width = (height * MODEL_SOURCE.w) / MODEL_SOURCE.h;
  return {
    left: f.modelCenterX + MODEL_OFFSETS[i] * height - width / 2,
    top: f.height - height,
    width,
    height,
  };
}

/** Desktop: figures sit right of center so the copy has the left third. The video is
 * bottom-anchored, so wide screens crop its top: the models stay below ~1/3 of the height (short laptop screens). */
export const DESKTOP = format(1920, 1080, 0.4, 0.66, 0.64);
/** Phone: narrow enough that cover-cropping on tall phones (19.5:9) keeps the outer figures. */
export const MOBILE = format(1080, 1920, 0.82, 0.41);
/** Darker gold for words on cream (large text, AA 3:1). */
export const GOLD_TEXT = "#9A7A35";
