import colors from "@/lib/brand-colors.json";
import { MARK, WORDMARK } from "./logo-paths";

// Logo as SVG data URLs for ImageResponse (link previews, the schema.org logo), which
// cannot read CSS variables: colours come from the token export (brand-colors.json).
const GREEN = colors.light.primary;
const GOLD = colors.light.accent;
const GOLD_LIGHT = colors.scene["gold-light"];
const CREAM = colors.light.bg;

const dataUrl = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

type Art = { letters: string; ring: (typeof WORDMARK)["ring"] | (typeof MARK)["ring"] };

/** Cream letters with the gold ring, for a green ground: far half, letters, near half, stone. */
const onGreen = ({ letters, ring }: Art) =>
  `<path fill="none" stroke="${GOLD}" stroke-width="${ring.stroke}" stroke-linecap="round" d="${ring.back}"/>` +
  `<path fill="${CREAM}" d="${letters}"/>` +
  `<path fill="none" stroke="${GOLD_LIGHT}" stroke-width="${ring.stroke}" stroke-linecap="round" d="${ring.front}"/>` +
  `<path fill="${CREAM}" stroke="${GOLD}" stroke-width="${ring.stoneStroke}" stroke-linejoin="round" d="${ring.stone}"/>`;

/** The compact mark (the J with its ring) on a full green square. */
export function markDataUrl(): string {
  return dataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
      `<rect width="64" height="64" fill="${GREEN}"/>${onGreen(MARK)}</svg>`,
  );
}

/** The wordmark for a green background: cream letters, gold ring. */
export function wordmarkOnGreenDataUrl(): string {
  return dataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WORDMARK.width} ${WORDMARK.height}">` +
      `${onGreen(WORDMARK)}</svg>`,
  );
}

/** Wordmark aspect ratio, to size it by height. */
export const WORDMARK_RATIO = WORDMARK.width / WORDMARK.height;
