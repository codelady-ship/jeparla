/**
 * Prepares the local, gitignored inputs of the social shorts (video/src/social/shorts/):
 *  - copies the licensed stock clips (Pexels, see docs/credits.md) and the hero walk-in from
 *    frontend/public into video/public/social/shorts/;
 *  - captures phone-size screens (390x844 CSS px, 1080 px wide) of the live site.
 *
 * Uses Playwright and sharp from frontend/node_modules (run `npm ci` in frontend first).
 * Usage: node video/scripts/social-assets.cjs [siteUrl]
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const FRONT = path.join(ROOT, "frontend");
const OUT = path.join(ROOT, "video", "public", "social", "shorts");
const SITE = process.argv[2] || "https://jeparla.duckdns.org";

const { chromium } = require(path.join(FRONT, "node_modules", "playwright"));
const sharp = require(path.join(FRONT, "node_modules", "sharp"));

const CLIPS = {
  "ring.mp4": "media/ring/desktop.mp4",
  "atelier.mp4": "media/atelier/desktop.mp4",
  "vitrine.mp4": "media/vitrine/desktop.mp4",
  "showcase.mp4": "media/showcase/desktop.mp4",
  "walk.mp4": "hero/enter-mobile.mp4",
};

/** name -> page and the heading scrolled to the top of the phone (null: top of the page). */
const SCREENS = {
  "home-top": ["/", null],
  "home-prices": ["/", "Gündəlik metal qiymətləri"],
  "home-checks": ["/", "Jeparla yoxlaması"],
  "sell-top": ["/sell", null],
  "sell-steps": ["/sell", "Necə işləyir"],
  "sell-compare": ["/sell", "Müqayisə"],
  "verified-top": ["/verified", null],
  "verified-checks": ["/verified", "Üç yoxlama"],
};

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, src] of Object.entries(CLIPS)) {
    fs.copyFileSync(path.join(FRONT, "public", src), path.join(OUT, name));
  }

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1080 / 390,
    isMobile: true,
    hasTouch: true,
    locale: "az-AZ",
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  let current = "";
  for (const [name, [url, heading]] of Object.entries(SCREENS)) {
    if (url !== current) {
      await page.goto(SITE + url, { waitUntil: "networkidle", timeout: 60000 });
      // Walk down once so lazy images and scroll reveals have loaded.
      const h = await page.evaluate(() => document.body.scrollHeight);
      for (let y = 0; y < h; y += 400) {
        await page.evaluate((v) => window.scrollTo(0, v), y);
        await page.waitForTimeout(120);
      }
      current = url;
    }
    if (heading) {
      const el = page.getByRole("heading", { name: heading, exact: true }).first();
      await el.evaluate((n) => {
        const top = n.getBoundingClientRect().top + window.scrollY - 76; // below the sticky header
        window.scrollTo(0, top);
      });
    } else {
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    await page.waitForTimeout(700);
    const text = await page.evaluate(() => document.body.innerText);
    if (/Nümunə data|Nümunə məhsul/i.test(text)) console.warn(`${name}: page shows demo data`);
    const png = await page.screenshot();
    await sharp(png).webp({ quality: 90 }).toFile(path.join(OUT, `${name}.webp`));
    console.log("screen", name);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
