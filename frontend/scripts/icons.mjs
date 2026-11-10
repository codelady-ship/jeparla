// Raster app icons for the web app manifest and iOS, drawn from src/app/icon.svg (the
// temporary mark until the logo, #50) in the brand colours from docs/design/tokens.json.
// Usage: npm run icons   (writes public/icons/*.png and src/app/apple-icon.png; commit them)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const tokens = JSON.parse(readFileSync(resolve(here, "../../docs/design/tokens.json"), "utf8"));
const { primary: tile, accent: glyph } = tokens.color.light;

const svg = readFileSync(resolve(here, "../src/app/icon.svg"), "utf8");
const path = svg.match(/<path d="([^"]+)"/)?.[1];
if (!path) throw new Error("icon.svg: no <path d> found");

/**
 * The mark on a 64-unit tile. `rounded` keeps the transparent corners of icon.svg
 * ("any" icons); full-bleed tiles are for maskable icons and iOS, which cut their own
 * shape. `scale` shrinks the letter around the centre (maskable safe zone).
 */
function mark({ rounded, scale = 1 }) {
  const t = `translate(32 32) scale(${scale}) translate(-32 -32)`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
      `<rect width="64" height="64" rx="${rounded ? 14 : 0}" fill="${tile}"/>` +
      `<path transform="${t}" d="${path}" fill="${glyph}"/></svg>`,
  );
}

const out = resolve(here, "../public/icons");
mkdirSync(out, { recursive: true });
const icons = [
  [resolve(out, "icon-192.png"), 192, { rounded: true }],
  [resolve(out, "icon-512.png"), 512, { rounded: true }],
  // Maskable: the letter stays inside the 80% safe circle at any mask shape.
  [resolve(out, "maskable-512.png"), 512, { rounded: false, scale: 0.86 }],
  [resolve(here, "../src/app/apple-icon.png"), 180, { rounded: false, scale: 0.92 }],
];
for (const [file, size, opts] of icons) {
  const png = await sharp(mark(opts), { density: (72 * size) / 64 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(file, png);
  console.log("wrote", file, `${png.length} B`);
}
