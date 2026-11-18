// Renders the comparison sheet (docs/brand/logo-options.html) to small PNGs in docs/brand/png/.
// Uses the frontend's Playwright (Chromium) and sharp:
//   FRONTEND_DIR=frontend node docs/brand/src/render-png.mjs
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const brand = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(resolve(process.env.FRONTEND_DIR ?? "frontend"), "package.json"));
const { chromium } = require("playwright");
const sharp = require("sharp");

const out = join(brand, "png");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1520, height: 1000 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(join(brand, "logo-options.html")).href);

const shots = await page.$$eval(".shot", (els) => els.map((e) => e.id));
for (const id of shots) {
  const buf = await page.locator(`#${id}`).screenshot();
  const name = id.replace(/^shot-/, "logo-");
  await sharp(buf).png({ palette: true, quality: 90, compressionLevel: 9, effort: 10 }).toFile(join(out, `${name}.png`));
  console.log(name);
}
await browser.close();
