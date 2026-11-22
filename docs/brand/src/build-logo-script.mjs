// Builds the Jeparla script logo (owner's choice 2026-11-22, draft "C"): the name in
// Great Vibes with a ring threaded on the head of the "J".
//
// The letters are Great Vibes (Copyright 2010 The Great Vibes Pro Project Authors, SIL Open
// Font License 1.1), outlined with fontkit, so the logo renders the same everywhere with no
// font file. OFL allows artwork made with the font, outlined glyphs included.
//
// Run (fontkit is not a project dependency, install it in a temp folder):
//   npm i fontkit@2.0.4 --prefix <tmp>
//   curl -L -o <tmp>/GreatVibes.ttf https://github.com/google/fonts/raw/main/ofl/greatvibes/GreatVibes-Regular.ttf
//   FONTKIT_DIR=<tmp> node docs/brand/src/build-logo-script.mjs <tmp>/GreatVibes.ttf
// Output: docs/brand/logo/script-*.svg, frontend/src/components/brand/logo-paths.ts and
// frontend/src/app/icon.svg (then `npm run icons` in frontend/ for the raster icons).
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "logo");
const require = createRequire(
  join(process.env.FONTKIT_DIR ?? process.cwd(), "noop.js"),
);
const fontkit = require("fontkit");
const font = fontkit.openSync(process.argv[2]);

// Palette: docs/design/tokens.json. Literal here because these are exported artwork files.
const C = {
  green: "#16251F",
  cream: "#F7F3EA",
  gold: "#C5A15A",
  goldLight: "#E8D39A",
  goldDeep: "#8C6A26",
};
const r = (n) => Math.round(n * 100) / 100;

/** Glyph outline to an SVG path: font units -> px, y flipped onto the baseline. */
function glyphD(glyph, s, x0, baseline) {
  const X = (x) => r(x0 + x * s);
  const Y = (y) => r(baseline - y * s);
  let d = "";
  for (const { command, args: a } of glyph.path.commands) {
    if (command === "moveTo") d += `M${X(a[0])} ${Y(a[1])}`;
    else if (command === "lineTo") d += `L${X(a[0])} ${Y(a[1])}`;
    else if (command === "quadraticCurveTo")
      d += `Q${X(a[0])} ${Y(a[1])} ${X(a[2])} ${Y(a[3])}`;
    else if (command === "bezierCurveTo")
      d += `C${X(a[0])} ${Y(a[1])} ${X(a[2])} ${Y(a[3])} ${X(a[4])} ${Y(a[5])}`;
    else if (command === "closePath") d += "Z";
  }
  return d;
}

/**
 * The ring on the J: a band seen at an angle, its far half behind the stroke and its near
 * half in front, with a small stone on the near half. Geometry in font units, relative to
 * the J's origin: centre 609 right and 355 above the baseline, 340 across, tilted 20 degrees.
 */
const RING = { cx: 609, cy: 355, size: 340, tilt: -20 };
function ring(s, x0, baseline) {
  const cx = x0 + RING.cx * s;
  const cy = baseline - RING.cy * s;
  const k = (RING.size * s) / 100; // the ring was drawn on a 100-unit box
  const a = (RING.tilt * Math.PI) / 180;
  const pt = (x, y) => [
    r(cx + (x * Math.cos(a) - y * Math.sin(a)) * k),
    r(cy + (x * Math.sin(a) + y * Math.cos(a)) * k),
  ];
  const [lx, ly] = pt(-45, 0);
  const [rx, ry] = pt(45, 0);
  const arc = (sweep) =>
    `M${lx} ${ly}A${r(45 * k)} ${r(16 * k)} ${RING.tilt} 0 ${sweep} ${rx} ${ry}`;
  const stone =
    "M" +
    [pt(-10, 10), pt(0, 0), pt(10, 10), pt(0, 22)]
      .map((p) => p.join(" "))
      .join("L") +
    "Z";
  return {
    back: arc(1),
    front: arc(0),
    stone,
    stroke: r(9 * k),
    stoneStroke: r(2 * k),
  };
}

function wordmark() {
  const s = 0.1;
  const run = font.layout("Jeparla");
  let x = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const items = run.glyphs.map((g, i) => {
    const it = { g, x };
    minX = Math.min(minX, x + g.bbox.minX);
    maxX = Math.max(maxX, x + g.bbox.maxX);
    minY = Math.min(minY, g.bbox.minY);
    maxY = Math.max(maxY, g.bbox.maxY);
    x += run.positions[i].xAdvance;
    return it;
  });
  const pad = 4;
  const x0 = pad - minX * s;
  const baseline = pad + maxY * s;
  const glyphs = items.map((it) => ({
    d: glyphD(it.g, s, x0 + it.x * s, baseline),
    x0: r(x0 + (it.x + it.g.bbox.minX) * s),
    x1: r(x0 + (it.x + it.g.bbox.maxX) * s),
  }));
  const letters = glyphs.map((g) => g.d).join("");
  return {
    glyphs,
    width: r((maxX - minX) * s + pad * 2),
    height: r((maxY - minY) * s + pad * 2),
    letters,
    ring: ring(s, x0, baseline),
  };
}

/** Compact mark on a 64-unit tile: the J with its ring. */
function mark() {
  const g = font.layout("J").glyphs[0];
  const box = 46;
  const s =
    box / Math.max(g.bbox.maxX - g.bbox.minX, g.bbox.maxY - g.bbox.minY);
  const w = (g.bbox.maxX - g.bbox.minX) * s;
  const h = (g.bbox.maxY - g.bbox.minY) * s;
  const x0 = (64 - w) / 2 - g.bbox.minX * s;
  const baseline = (64 - h) / 2 + g.bbox.maxY * s;
  return {
    size: 64,
    letters: glyphD(g, s, x0, baseline),
    ring: ring(s, x0, baseline),
  };
}

const draw = (
  o,
  ink,
  {
    back = C.goldDeep,
    front = C.gold,
    stone = C.goldLight,
    edge = C.goldDeep,
  } = {},
) =>
  `<path fill="none" stroke="${back}" stroke-width="${o.ring.stroke}" stroke-linecap="round" d="${o.ring.back}"/>` +
  `<path fill="${ink}" d="${o.letters}"/>` +
  `<path fill="none" stroke="${front}" stroke-width="${o.ring.stroke}" stroke-linecap="round" d="${o.ring.front}"/>` +
  `<path fill="${stone}" stroke="${edge}" stroke-width="${o.ring.stoneStroke}" stroke-linejoin="round" d="${o.ring.stone}"/>`;
const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Jeparla"><title>Jeparla</title>${body}</svg>\n`;

const wm = wordmark();
const mk = mark();
mkdirSync(out, { recursive: true });
for (const [theme, ink, bg] of [
  ["light", C.green, C.cream],
  ["dark", C.cream, C.green],
]) {
  const back = theme === "light" ? C.goldDeep : C.gold;
  const front = theme === "light" ? C.gold : C.goldLight;
  writeFileSync(
    join(out, `script-wordmark-${theme}.svg`),
    svg(wm.width, wm.height, draw(wm, ink, { back, front })),
  );
  const pad = 30;
  writeFileSync(
    join(out, `script-lockup-${theme}.svg`),
    svg(
      r(wm.width + pad * 2),
      r(wm.height + pad * 2),
      `<rect width="100%" height="100%" fill="${bg}"/><g transform="translate(${pad} ${pad})">${draw(wm, ink, { back, front })}</g>`,
    ),
  );
}
// The mark: a cream J with a gold ring on the green tile (favicon, app icons, /logo.png).
const tile = (rx) =>
  svg(
    64,
    64,
    `<rect width="64" height="64" rx="${rx}" fill="${C.green}"/>` +
      draw(mk, C.cream, {
        back: C.gold,
        front: C.goldLight,
        stone: C.cream,
        edge: C.gold,
      }),
  );
writeFileSync(join(out, "script-mark.svg"), tile(14));

const app = join(here, "..", "..", "..", "frontend", "src");
writeFileSync(
  join(app, "app", "icon.svg"),
  tile(14).replace(
    / width="64" height="64" role="img" aria-label="Jeparla"><title>Jeparla<\/title>/,
    ">",
  ),
);
const part = (o) => `  letters: "${o.letters}",
  ring: {
    back: "${o.ring.back}",
    front: "${o.ring.front}",
    stone: "${o.ring.stone}",
    stroke: ${o.ring.stroke},
    stoneStroke: ${o.ring.stoneStroke},
  },`;
writeFileSync(
  join(app, "components", "brand", "logo-paths.ts"),
  `// Generated by docs/brand/src/build-logo-script.mjs (script logo, owner's choice 2026-11-22).
// Do not edit. Geometry only: colours come from the design tokens where the paths are drawn.

/** Wordmark "Jeparla" in outlined script, with the ring threaded on the head of the J. */
export const WORDMARK = {
  width: ${wm.width},
  height: ${wm.height},
${part(wm)}
  /** The same letters one by one, with their horizontal extent (the hero writes them in turn). */
  glyphs: [
${wm.glyphs.map((g) => `    { d: "${g.d}", x0: ${g.x0}, x1: ${g.x1} },`).join("\n")}
  ],
} as const;

/** Compact mark on a 64-unit tile: the J with its ring. */
export const MARK = {
  size: 64,
${part(mk)}
} as const;
`,
);
console.log(
  "wordmark",
  wm.width,
  "x",
  wm.height,
  "written to",
  out,
  "and",
  app,
);
