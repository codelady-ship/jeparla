// Figure boxes measured on the 1248x696 source frame (split.cjs output).
export const SOURCE = { w: 1248, h: 696 };

export const TIGERS = [
  { left: 269, top: 167, width: 233, height: 463 },
  { left: 502, top: 175, width: 261, height: 456 },
  { left: 763, top: 158, width: 205, height: 469 },
];

export const MODELS = [
  { left: 275, top: 73, width: 238, height: 623 },
  { left: 513, top: 76, width: 252, height: 620 },
  { left: 765, top: 62, width: 242, height: 634 },
];

/** Site cream (docs/design/tokens.json, scene ivory). */
export const BACKDROP = "#F7F3EA";
export const GOLD = "#C5A15A";
export const GOLD_LIGHT = "#E8D39A";

export const FPS = 30;
/** Act 1: tigers walk in (autoplay). */
export const ENTER = 96;
/** Act 2: light sweep turns each tiger into a model (scroll-scrubbed). */
export const TRANSFORM = 72;

export type Format = { width: number; height: number; scale: number; x: number; y: number };

/**
 * Places the 1248x696 source frame in the composition. Models touch the bottom
 * edge of the source, so the source is always bottom-aligned.
 */
export function format(width: number, height: number, figureShare: number): Format {
  const span = 1007 - 269; // figures' horizontal extent in the source
  const scale = (width * figureShare) / span;
  const x = width / 2 - (269 + span / 2) * scale;
  const y = height - SOURCE.h * scale;
  return { width, height, scale, x, y };
}

export const DESKTOP = format(1280, 720, 0.5);
export const MOBILE = format(720, 1280, 0.86);
