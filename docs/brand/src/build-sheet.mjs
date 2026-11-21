// Builds docs/brand/logo-options.html: the static comparison sheet of the three logo options
// (issue #50). The SVGs from build-logos.mjs are inlined, so the page opens from disk with no
// server and no font files. Run: node docs/brand/src/build-sheet.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const brand = join(dirname(fileURLToPath(import.meta.url)), "..");
const raw = (f) => readFileSync(join(brand, "logo", f), "utf8").trim();
// Inline SVG sized by CSS height; ids are not used inside, so repeats are safe.
const inline = (f, h, cls = "") =>
  raw(f)
    .replace(/ width="[^"]+" height="[^"]+"/, "")
    .replace("<svg ", `<svg class="${cls}" style="height:${h}px;width:auto" `);
const img = (f, s) =>
  `<img src="logo/${f}" width="${s}" height="${s}" alt="${s} px">`;

const dirs = [
  {
    key: "a",
    name: "A. Baget",
    idea:
      "Cormorant ilə yığılmış sakit serif söz-nişan. Yeganə detal: “l” hərfi şaquli dayanan baget kəsimli daşdır, iki qızılı tərəfi var (biri işıqlı, biri kölgəli). Uzaqdan adi “Jeparla” oxunur, yaxından zərgərlik hiss olunur. Kompakt nişan: “J” və yanında eyni baget.",
    pro: "Ən oxunaqlı və ən sakit variant; başlıqdakı indiki yazıya ən yaxındır, keçid asandır.",
    con: "Nişan (J + baget) 16 px-də sadə görünür; gücü söz-nişandadır.",
    header: (t) => inline(`a-wordmark-${t}.svg`, 34),
  },
  {
    key: "b",
    name: "B. Pilləli kəsim",
    idea:
      "Monoqram: düz kəsiklərdən qurulmuş “J”, hər küncü pilləli (emerald) kəsim kimi kəsilib; ətrafında səkkizbucaqlı çərçivə, daşın öz formasıdır. Söz-nişan geniş aralıqlı böyük hərflərlə. Nişan və söz ayrıca da işləyir.",
    pro: "Ən güclü ikon: favicon, tətbiq ikonu, Instagram profil şəkli üçün ən aydın forma.",
    con: "Geniş aralıqlı böyük serif hərflər lüks kateqoriyada çox yayılıb; fərqi monoqram daşıyır, söz-nişan yox.",
    header: (t) =>
      `<span class="lockup">${inline(`b-mark-${t}.svg`, 34)}${inline(`b-wordmark-${t}.svg`, 21)}</span>`,
  },
  {
    key: "c",
    name: "C. Damğa",
    idea:
      "Kiçik hərflərlə “jeparla”; “j” hərfinin nöqtəsi əyar damğasıdır: küncləri içəri oyulmuş kiçik möhür. Mesaj: metal yoxlanılıb, məlumat dürüstdür. Kompakt nişan eyni möhür formasındadır, içində “j” və onun damğa-nöqtəsi.",
    pro: "Ən çox hekayə daşıyan variant: əyar, yoxlanılmış məlumat, dürüstlük; başqa zərgər loqolarına bənzəmir.",
    con: "Damğa-nöqtə kiçik ölçüdə adi nöqtə kimi görünür; ideya böyük ölçüdə və nişanda oxunur.",
    header: (t) => inline(`c-wordmark-${t}.svg`, 36),
  },
];

const icon = {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  heart:
    '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
};
const ic = (n) =>
  `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon[n]}</svg>`;

function header(d, theme, width) {
  const wide = width > 768;
  return `<div class="hdr hdr-${theme}" style="width:${width}px">
  <div class="hdr-in${wide ? " wide" : ""}">
    ${wide ? "" : ic("menu")}
    <span class="hdr-logo">${d.header(theme)}</span>
    ${wide ? '<nav><span>Kataloq</span><span>Mağazalar</span><span>Kateqoriyalar</span></nav>' : ""}
    <span class="hdr-icons">${ic("search")}${ic("heart")}${ic("user")}</span>
  </div>
</div>`;
}

const section = (d) => `
<section class="dir" id="dir-${d.key}">
  <h2>${d.name}</h2>
  <p class="idea">${d.idea}</p>
  <dl class="pc"><div><dt>Güclü tərəfi</dt><dd>${d.pro}</dd></div><div><dt>Riski</dt><dd>${d.con}</dd></div></dl>

  <div class="shot" id="shot-${d.key}-large">
    <div class="field cream">${inline(`${d.key}-wordmark-light.svg`, 150)}</div>
    <div class="field green">${inline(`${d.key}-wordmark-dark.svg`, 150)}</div>
    <div class="field cream marks">${inline(`${d.key}-mark-light.svg`, 160)}</div>
    <div class="field green marks">${inline(`${d.key}-mark-dark.svg`, 160)}</div>
  </div>

  <h3>Kiçik ölçü: 16, 32, 48 px</h3>
  <div class="shot sizes" id="shot-${d.key}-favicons">
    <div class="field cream">${[16, 32, 48].map((s) => img(`${d.key}-mark-light.svg`, s)).join("")}<span class="tab">${img(`${d.key}-mark-light.svg`, 16)} Jeparla</span></div>
    <div class="field green">${[16, 32, 48].map((s) => img(`${d.key}-mark-dark.svg`, s)).join("")}<span class="tab tab-dark">${img(`${d.key}-mark-dark.svg`, 16)} Jeparla</span></div>
  </div>

  <h3>Saytın başlığında: 390 px və 1440 px</h3>
  <div class="shot headers" id="shot-${d.key}-header">
    ${header(d, "light", 390)}
    ${header(d, "dark", 390)}
    ${header(d, "light", 1440)}
    ${header(d, "dark", 1440)}
  </div>
</section>`;

const compare = `
<section id="compare">
  <h2>Yan-yana</h2>
  <div class="shot cmp" id="shot-compare">
    ${dirs
      .map(
        (d) => `<div class="cmp-col">
      <p class="cmp-name">${d.name}</p>
      <div class="field cream">${raw(`${d.key}-lockup-light.svg`).replace(/ width="[^"]+" height="[^"]+"/, "").replace("<svg ", '<svg style="width:100%;height:auto" ')}</div>
      <div class="field green">${raw(`${d.key}-lockup-dark.svg`).replace(/ width="[^"]+" height="[^"]+"/, "").replace("<svg ", '<svg style="width:100%;height:auto" ')}</div>
      <div class="field cream row">${[16, 32, 48].map((s) => img(`${d.key}-mark-light.svg`, s)).join("")}${[16, 32, 48].map((s) => img(`${d.key}-mark-dark.svg`, s)).join("")}</div>
    </div>`,
      )
      .join("")}
  </div>
</section>`;

const html = `<!doctype html>
<html lang="az">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Jeparla loqo variantları</title>
<style>
/* Tokens: docs/design/tokens.json. Static review sheet, not part of the app. */
:root {
  --cream: #F7F3EA; --green: #16251F; --deep: #0E1814; --white: #FFFFFF;
  --text: #292929; --muted: #5E5A52; --border: #E2D9C6; --gold-text: #7A5B1F;
  --on-dark: #F7F3EA; --on-dark-muted: #B9B3A6; --dark-border: #2B3F36;
  --font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
html, body { overflow-x: clip; }
body { margin: 0; background: var(--white); color: var(--text); font: 16px/1.55 var(--font); }
main { max-width: 1520px; margin: 0 auto; padding: 40px 16px 80px; }
h1 { font-size: 32px; line-height: 1.2; margin: 0 0 8px; font-weight: 600; }
h2 { font-size: 26px; margin: 0 0 8px; font-weight: 600; }
h3 { font-size: 16px; margin: 32px 0 12px; font-weight: 600; color: var(--muted); }
.lead { max-width: 70ch; color: var(--muted); margin: 0 0 40px; }
.dir, #compare { border-top: 1px solid var(--border); padding: 40px 0; }
.idea { max-width: 75ch; margin: 0 0 12px; }
.pc { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 16px; max-width: 900px; margin: 0 0 24px; }
.pc dt { font-weight: 600; } .pc dd { margin: 0; color: var(--muted); }
.shot { display: grid; gap: 12px; padding: 12px; background: var(--white); }
#shot-a-large, #shot-b-large, #shot-c-large { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.field { display: flex; align-items: center; justify-content: center; gap: 24px; padding: 40px 24px; border-radius: 8px; min-width: 0; }
.field svg { max-width: 100%; }
.cream { background: var(--cream); } .green { background: var(--green); }
.marks { gap: 32px; }
.sizes { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.sizes .field { gap: 28px; padding: 28px; justify-content: flex-start; }
.tab { display: inline-flex; align-items: center; gap: 8px; margin-left: auto; padding: 8px 14px; border-radius: 8px 8px 0 0; background: var(--white); font-size: 13px; }
.tab-dark { background: var(--deep); color: var(--on-dark); }
.headers { justify-items: start; background: var(--border); border-radius: 8px; }
.hdr { height: 64px; box-shadow: 0 1px 0 var(--border); }
.hdr-light { background: var(--cream); color: var(--text); }
.hdr-dark { background: var(--deep); color: var(--on-dark); box-shadow: 0 1px 0 var(--dark-border); }
.hdr-in { height: 100%; display: flex; align-items: center; gap: 8px; padding: 0 16px; }
.hdr-in.wide { max-width: 1280px; margin: 0 auto; padding: 0 32px; }
.hdr-logo { display: inline-flex; align-items: center; padding: 0 4px; }
.lockup { display: inline-flex; align-items: center; gap: 10px; }
.hdr nav { display: flex; gap: 24px; margin-left: 32px; font-size: 14px; font-weight: 500; }
.hdr-icons { margin-left: auto; display: flex; gap: 4px; }
.ic { width: 20px; height: 20px; padding: 10px; }
.cmp { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.cmp-col { display: grid; gap: 12px; align-content: start; min-width: 0; }
.cmp-name { margin: 0; font-weight: 600; font-size: 18px; }
.cmp .field { padding: 12px; }
.row { gap: 14px; }
@media (max-width: 900px) {
  #shot-a-large, #shot-b-large, #shot-c-large, .sizes, .cmp { grid-template-columns: minmax(0, 1fr); }
  .headers { overflow-x: auto; }
}
</style>
</head>
<body>
<main>
<h1>Jeparla loqo variantları</h1>
<p class="lead">Issue #50. Üç istiqamət, sahib birini seçir. Hərflər Cormorant şriftindən konturlanıb (SIL Open Font License 1.1), loqo şriftsiz, hər yerdə eyni görünür. Rənglər yalnız palitradan: tünd yaşıl, qızılı, krem. Seçimdən sonra seçilmiş variant sayta, favicon-a və tətbiq ikonuna köçürüləcək; bu səhifə saytın bir hissəsi deyil.</p>
${compare}
${dirs.map(section).join("\n")}
</main>
</body>
</html>
`;
writeFileSync(join(brand, "logo-options.html"), html);
console.log("written logo-options.html");
