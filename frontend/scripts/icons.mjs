// Raster app icons for the web app manifest, iOS and old browsers, drawn from src/app/icon.svg
// (logo option A, #50: the J and the baguette stone; source docs/brand/src/build-logos.mjs).
// Usage: npm run icons   (writes public/icons/*.png, src/app/apple-icon.png and
// src/app/favicon.ico; commit them)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const tokens = JSON.parse(readFileSync(resolve(here, "../../docs/design/tokens.json"), "utf8"));
const tile = tokens.color.light.primary;

const svg = readFileSync(resolve(here, "../src/app/icon.svg"), "utf8");
// Everything drawn on the tile: the paths after the background <rect>.
const art = svg.match(/<rect[^>]*\/>([\s\S]*)<\/svg>/)?.[1];
if (!art) throw new Error("icon.svg: expected a <rect> tile followed by the mark");

/**
 * The mark on a 64-unit tile. `rounded` keeps the transparent corners of icon.svg
 * ("any" icons); full-bleed tiles are for maskable icons and iOS, which cut their own
 * shape. `scale` shrinks the mark around the centre (maskable safe zone).
 */
function mark({ rounded, scale = 1 }) {
  const t = `translate(32 32) scale(${scale}) translate(-32 -32)`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
      `<rect width="64" height="64" rx="${rounded ? 14 : 0}" fill="${tile}"/>` +
      `<g transform="${t}">${art}</g></svg>`,
  );
}

const render = (size, opts) =>
  sharp(mark(opts), { density: Math.max(72, (72 * size) / 64) })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();

const out = resolve(here, "../public/icons");
mkdirSync(out, { recursive: true });
const icons = [
  [resolve(out, "icon-192.png"), 192, { rounded: true }],
  [resolve(out, "icon-512.png"), 512, { rounded: true }],
  // Maskable: the mark stays inside the 80% safe circle at any mask shape.
  [resolve(out, "maskable-512.png"), 512, { rounded: false, scale: 0.8 }],
  [resolve(here, "../src/app/apple-icon.png"), 180, { rounded: false, scale: 0.9 }],
];
for (const [file, size, opts] of icons) {
  const png = await render(size, opts);
  writeFileSync(file, png);
  console.log("wrote", file, `${png.length} B`);
}

// favicon.ico for browsers and tools that ask for /favicon.ico: 16, 32 and 48 px PNG entries.
const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map((s) => render(s, { rounded: true })));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = 6 + 16 * sizes.length;
const entries = sizes.map((s, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(s, 0);
  e.writeUInt8(s, 1);
  e.writeUInt16LE(1, 4); // colour planes
  e.writeUInt16LE(32, 6); // bits per pixel
  e.writeUInt32LE(pngs[i].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += pngs[i].length;
  return e;
});
const ico = Buffer.concat([header, ...entries, ...pngs]);
writeFileSync(resolve(here, "../src/app/favicon.ico"), ico);
console.log("wrote favicon.ico", `${ico.length} B`);
