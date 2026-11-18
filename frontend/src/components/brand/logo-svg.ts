import colors from "@/lib/brand-colors.json";
import { MARK, WORDMARK } from "./logo-paths";

// Logo as SVG data URLs for ImageResponse (link previews, the schema.org logo), which
// cannot read CSS variables: colours come from the token export (brand-colors.json).
const GREEN = colors.light.primary;
const GOLD = colors.light.accent;
const GOLD_LIGHT = colors.scene["gold-light"];
const CREAM = colors.light.bg;

const dataUrl = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

/** The compact mark (J and the baguette stone, gold) on a full green square. */
export function markDataUrl(): string {
  return dataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
      `<rect width="64" height="64" fill="${GREEN}"/>` +
      `<path fill="${GOLD}" d="${MARK.letters}"/>` +
      `<path fill="${GOLD}" d="${MARK.faceL}"/>` +
      `<path fill="${GOLD_LIGHT}" d="${MARK.faceR}"/></svg>`,
  );
}

/** The wordmark for a green background: cream letters, gold stone. */
export function wordmarkOnGreenDataUrl(): string {
  return dataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WORDMARK.width} ${WORDMARK.height}">` +
      `<path fill="${CREAM}" d="${WORDMARK.letters}"/>` +
      `<path fill="${GOLD}" d="${WORDMARK.faceL}"/>` +
      `<path fill="${GOLD_LIGHT}" d="${WORDMARK.faceR}"/></svg>`,
  );
}

/** Wordmark aspect ratio, to size it by height. */
export const WORDMARK_RATIO = WORDMARK.width / WORDMARK.height;
