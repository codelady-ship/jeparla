// Runs demo catalog photos through the admin "Product photos" page (/admin/photos), the same
// in-browser "fit to design" step an admin uses, and saves what the page downloads.
// Sample data only: it signs in with the demo admin of NEXT_PUBLIC_USE_MOCK=true (any password,
// local server); it never touches the real API or a real account.
//
// Usage (a local production build with the sample data must be running):
//   NEXT_PUBLIC_USE_MOCK=true npm run build && npx next start -p 3200
//   node scripts/fit-demo-photos.mjs --base http://localhost:3200 --out ../build/fitted <photos...>
// Each output is named after the photo ("ring-gold-2.jpg" -> "ring-gold-2-fit.webp"); a photo
// whose fit fails is reported and skipped (keep the original then).
import { mkdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  const [value] = args.splice(i, 2).slice(1);
  return value;
};
const base = flag("--base", "http://localhost:3200");
const out = resolve(flag("--out", "../build/fitted"));
const photos = args.map((p) => resolve(p));
if (photos.length === 0) {
  console.error("No photos given.");
  process.exit(2);
}
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  acceptDownloads: true,
  viewport: { width: 1440, height: 900 },
});
try {
  await page.goto(`${base}/en/login`);
  await page.getByLabel("E-mail").fill("admin@example.com");
  await page.getByLabel("Password", { exact: true }).fill(`Demo-${Date.now()}-pass`);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
  await page.goto(`${base}/en/admin/photos`);
  await page.getByLabel("Choose photos").setInputFiles(photos);

  const items = page.getByRole("list", { name: "Photos being fitted" }).getByRole("listitem");
  for (const photo of photos) {
    const name = basename(photo);
    const item = items.filter({ hasText: name });
    const use = item.getByRole("button", { name: "Use the fitted photo" });
    // The first photo also loads ONNX Runtime and the model.
    await item
      .getByRole("img", { name: `${name}: photo fitted to the design` })
      .or(item.getByText(/could not|No item/))
      .waitFor({ timeout: 120_000 });
    if (!(await use.isEnabled())) {
      console.warn(`${name}: not fitted, keep the original`);
      continue;
    }
    await use.click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      item.getByRole("link", { name: /^Download / }).click(),
    ]);
    const target = resolve(out, download.suggestedFilename());
    await download.saveAs(target);
    console.log(`${name} -> ${target}`);
  }
} finally {
  await browser.close();
}
