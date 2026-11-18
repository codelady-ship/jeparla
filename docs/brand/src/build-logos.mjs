// Builds the three Jeparla logo options (issue #50) as plain SVG paths.
//
// The letters are Cormorant (SIL Open Font License 1.1, no Reserved Font Name), outlined
// with fontkit at a fixed weight, so the logo renders the same everywhere with no font file.
// OFL allows artwork made with the font, outlined glyphs included; see docs/brand/README.md.
//
// Run (fontkit is not a project dependency, install it in a temp folder):
//   npm i fontkit@2.0.4 --prefix <tmp>
//   curl -L -o <tmp>/Cormorant.ttf https://github.com/google/fonts/raw/main/ofl/cormorant/Cormorant%5Bwght%5D.ttf
//   FONTKIT_DIR=<tmp> node docs/brand/src/build-logos.mjs <tmp>/Cormorant.ttf
// Output: docs/brand/logo/*.svg
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "logo");
const require = createRequire(join(process.env.FONTKIT_DIR ?? process.cwd(), "noop.js"));
const fontkit = require("fontkit");
const base = fontkit.openSync(process.argv[2]);

// Palette: docs/design/tokens.json (light/dark/scene). Kept literal here because these are
// exported artwork files, not app components.
const C = {
  green: "#16251F",
  deep: "#0E1814",
  cream: "#F7F3EA",
  gold: "#C5A15A",
  goldLight: "#E8D39A",
  goldDeep: "#8C6A26",
};

const r = (n) => Math.round(n * 100) / 100;

/** Glyph outline to an SVG path, font units -> px (y flipped), optional subpath filter. */
function glyphD(glyph, s, x0, base0, keep = () => true) {
  const subs = [];
  let cur = null;
  for (const c of glyph.path.commands) {
    if (c.command === "moveTo") {
      cur = [];
      subs.push(cur);
    }
    cur.push(c);
  }
  const X = (x) => r(x0 + x * s);
  const Y = (y) => r(base0 - y * s);
  let d = "";
  for (const sub of subs) {
    const ys = [];
    for (const c of sub) for (let i = 1; i < c.args.length; i += 2) ys.push(c.args[i]);
    if (!keep({ minY: Math.min(...ys), maxY: Math.max(...ys) })) continue;
    for (const { command, args: a } of sub) {
      if (command === "moveTo") d += `M${X(a[0])} ${Y(a[1])}`;
      else if (command === "lineTo") d += `L${X(a[0])} ${Y(a[1])}`;
      else if (command === "quadraticCurveTo") d += `Q${X(a[0])} ${Y(a[1])} ${X(a[2])} ${Y(a[3])}`;
      else if (command === "bezierCurveTo")
        d += `C${X(a[0])} ${Y(a[1])} ${X(a[2])} ${Y(a[3])} ${X(a[4])} ${Y(a[5])}`;
      else if (command === "closePath") d += "Z";
    }
  }
  return d;
}

/** Centre of the j's dot (the subpath above the x-height), in font units. */
function dotCentre(glyph) {
  const xs = [];
  const ys = [];
  let inDot = false;
  for (const c of glyph.path.commands) {
    if (c.command === "moveTo") inDot = c.args[1] > 450;
    if (!inDot) continue;
    for (let i = 0; i < c.args.length; i += 2) xs.push(c.args[i]), ys.push(c.args[i + 1]);
  }
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

/** Lays out text; returns per-glyph {glyph, x} in font units plus the total advance. */
function layout(text, wght, tracking = 0, kernPairs = {}) {
  const f = base.getVariation({ wght });
  const run = f.layout(text);
  let x = 0;
  const items = run.glyphs.map((g, i) => {
    const item = { glyph: g, x, ch: text[i] };
    x += run.positions[i].xAdvance + tracking + (kernPairs[text.slice(i, i + 2)] ?? 0);
    return item;
  });
  return { items, width: x - tracking };
}

const poly = (pts) => "M" + pts.map(([x, y]) => `${r(x)} ${r(y)}`).join("L") + "Z";
const svg = (w, h, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r(w)} ${r(h)}" width="${r(w)}" height="${r(h)}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>\n`;
const path = (d, fill) => `<path fill="${fill}" d="${d}"/>`;

// ---------------------------------------------------------------- A: Baguette wordmark
// Title-case serif wordmark; the "l" is a standing baguette-cut stone in two gold facets.
function wordmarkA(theme) {
  const ink = theme === "light" ? C.green : C.cream;
  const faceL = C.gold;
  const faceR = theme === "light" ? C.goldDeep : C.goldLight;
  const s = 0.1; // 1000 upm -> 100px em
  const { items, width } = layout("Jeparla", 560, 6, { Je: -18 });
  const gl = 76; // baseline
  const asc = 72.5; // l height
  let d = "";
  let gems = "";
  const parts = {};
  const padL = 6;
  for (const it of items) {
    if (it.ch === "l") {
      const cx = padL + (it.x + 122) * s;
      const w = 5.2;
      const tip = 5;
      const yT = gl - asc;
      const yB = gl;
      parts.faceL = poly([[cx, yT], [cx, yB], [cx - w, yB - tip], [cx - w, yT + tip]]);
      parts.faceR = poly([[cx, yT], [cx + w, yT + tip], [cx + w, yB - tip], [cx, yB]]);
      gems += path(parts.faceL, faceL) + path(parts.faceR, faceR);
      continue;
    }
    d += glyphD(it.glyph, s, padL + it.x * s, gl);
  }
  const W = padL * 2 + width * s;
  const H = gl + 28;
  return { w: W, h: H, body: path(d, ink) + gems, ink, parts: { ...parts, letters: d } };
}

function markA(theme) {
  const bg = theme === "light" ? C.green : C.cream;
  const ink = theme === "light" ? C.gold : C.green;
  const f = base.getVariation({ wght: 620 });
  const g = f.layout("J").glyphs[0];
  const s = 0.052;
  const d = glyphD(g, s, 20.3, 42);
  const cx = 43.1;
  const w = 3.6;
  const tip = 3.4;
  const yT = 9.5;
  const yB = 42;
  const faceR = theme === "light" ? C.goldLight : C.goldDeep;
  const pL = poly([[cx, yT], [cx, yB], [cx - w, yB - tip], [cx - w, yT + tip]]);
  const pR = poly([[cx, yT], [cx + w, yT + tip], [cx + w, yB - tip], [cx, yB]]);
  const body =
    `<rect width="64" height="64" rx="14" fill="${bg}"/>` +
    path(d, ink) +
    path(pL, theme === "light" ? C.gold : C.goldDeep) +
    path(pR, faceR);
  return { w: 64, h: 64, body, parts: { letters: d, faceL: pL, faceR: pR } };
}

// ---------------------------------------------------------------- B: Step-cut monogram
// A J built from straight facets inside an emerald-cut (octagon) frame, with a spaced
// capital wordmark.
function octagon(x, y, w, h, c) {
  return [[x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + h - c], [x + w - c, y + h], [x + c, y + h], [x, y + h - c], [x, y + c]];
}
function markB(theme, { tile = true } = {}) {
  const bg = theme === "light" ? C.green : C.cream;
  const line = theme === "light" ? C.gold : C.green;
  const ink = theme === "light" ? C.gold : C.green;
  let body = "";
  if (tile) body += path(poly(octagon(2, 2, 60, 60, 15)), bg);
  // Inner frame: an octagon ring (outer minus inner, even-odd).
  body += `<path fill="${line}" fill-rule="evenodd" d="${poly(octagon(7, 7, 50, 50, 12.5))}${poly(octagon(9.5, 9.5, 45, 45, 11.4))}"/>`;
  // Faceted J: top bar, stem, chamfered hook. Constant 7-unit stroke.
  const J = [[24, 17], [41, 17], [41, 41], [34, 48], [27, 48], [21, 42], [21, 35], [28, 35], [28, 39], [29.5, 40.5], [31.5, 40.5], [34, 38], [34, 23], [24, 23]];
  body += path(poly(J), ink);
  // The cut is in the outline itself: every corner of the J is a chamfer, like a step-cut stone.
  return { w: 64, h: 64, body };
}
function wordmarkB(theme) {
  const ink = theme === "light" ? C.green : C.cream;
  const s = 0.1;
  const { items, width } = layout("JEPARLA", 480, 150);
  let d = "";
  for (const it of items) d += glyphD(it.glyph, s, 4 + it.x * s, 70);
  return { w: width * s + 8, h: 98, body: path(d, ink), ink };
}

// ---------------------------------------------------------------- C: Hallmark stamp
// Lowercase wordmark; the dot of the j is a small assay-stamp cartouche (cushion shape
// with inward corners), the mark of a checked metal.
function cushion(x, y, w, h, k) {
  // Rectangle whose four corners are scooped inward by quarter circles of radius k.
  return (
    `M${r(x + k)} ${r(y)}H${r(x + w - k)}A${k} ${k} 0 0 0 ${r(x + w)} ${r(y + k)}` +
    `V${r(y + h - k)}A${k} ${k} 0 0 0 ${r(x + w - k)} ${r(y + h)}` +
    `H${r(x + k)}A${k} ${k} 0 0 0 ${r(x)} ${r(y + h - k)}` +
    `V${r(y + k)}A${k} ${k} 0 0 0 ${r(x + k)} ${r(y)}Z`
  );
}
function wordmarkC(theme) {
  const ink = theme === "light" ? C.green : C.cream;
  const stamp = theme === "light" ? C.goldDeep : C.gold;
  const s = 0.1;
  const { items, width } = layout("jeparla", 600, 4);
  const baseY = 66;
  let d = "";
  let jx = 0;
  let dot = null;
  for (const it of items) {
    if (it.ch === "j") {
      jx = 8 + it.x * s;
      dot = dotCentre(it.glyph);
      d += glyphD(it.glyph, s, jx, baseY, (b) => b.minY < 450); // drop the dot
    } else d += glyphD(it.glyph, s, 8 + it.x * s, baseY);
  }
  // The stamp takes the place of the dot, centred where the dot was.
  const sx = jx + dot.x * s;
  const sy = baseY - dot.y * s;
  const body = path(d, ink) + path(cushion(sx - 7.5, sy - 6, 15, 12, 3), stamp);
  return { w: width * s + 16, h: baseY + 34, body, ink };
}
function markC(theme) {
  const bg = theme === "light" ? C.green : C.gold;
  const ink = theme === "light" ? C.cream : C.green;
  const f = base.getVariation({ wght: 700 });
  const g = f.layout("j").glyphs[0];
  const s = 0.056;
  const body =
    path(cushion(2, 2, 60, 60, 11), bg) +
    path(glyphD(g, s, 26.7, 42, (b) => b.minY < 450), ink) +
    path(cushion(26.7 + dotCentre(g).x * s - 5.5, 42 - dotCentre(g).y * s - 4.5, 11, 9, 2.4), theme === "light" ? C.gold : C.green);
  return { w: 64, h: 64, body };
}

// ---------------------------------------------------------------- lockups and files
function lockup(mark, word, bg, { gap = 22, pad = 40, markH } = {}) {
  const k = markH / mark.h;
  const wk = 1;
  const H = Math.max(markH, word.h * wk) + pad * 2;
  const W = pad * 2 + markH + gap + word.w * wk;
  const my = (H - markH) / 2;
  const wy = (H - word.h * wk) / 2;
  const body =
    `<rect width="${r(W)}" height="${r(H)}" fill="${bg}"/>` +
    `<g transform="translate(${pad} ${r(my)}) scale(${r(k * 1000) / 1000})">${mark.body}</g>` +
    `<g transform="translate(${r(pad + markH + gap)} ${r(wy)})">${word.body}</g>`;
  return { w: W, h: H, body };
}
function onBg(word, bg, pad = 40) {
  const body = `<rect width="${r(word.w + pad * 2)}" height="${r(word.h + pad * 2)}" fill="${bg}"/><g transform="translate(${pad} ${pad})">${word.body}</g>`;
  return { w: word.w + pad * 2, h: word.h + pad * 2, body };
}

const directions = {
  a: { name: "Jeparla, option A", word: wordmarkA, mark: markA, markH: 84, lockupMark: false },
  b: { name: "Jeparla, option B", word: wordmarkB, mark: markB, markH: 96, lockupMark: true },
  c: { name: "Jeparla, option C", word: wordmarkC, mark: markC, markH: 84, lockupMark: false },
};

mkdirSync(out, { recursive: true });
for (const [key, dir] of Object.entries(directions)) {
  for (const theme of ["light", "dark"]) {
    const bg = theme === "light" ? C.cream : C.green;
    const word = dir.word(theme);
    const mark = dir.mark(theme);
    const write = (name, o) => writeFileSync(join(out, `${key}-${name}-${theme}.svg`), svg(o.w, o.h, o.body, dir.name));
    write("wordmark", word);
    write("mark", mark);
    // Lockup: on its own background. B pairs the monogram with the caps wordmark; A and C
    // carry their detail inside the wordmark, so the lockup is the wordmark on its field.
    write("lockup", dir.lockupMark ? lockup(mark, word, bg, { markH: dir.markH }) : onBg(word, bg));
  }
}
// The chosen option (A, owner decision 2026-11-18) also goes to the app as path data only:
// the app colours it with design tokens (wordmark) or the brand colours (icons, OG images).
const wa = wordmarkA("light");
const ma = markA("light");
const ts = `// Generated by docs/brand/src/build-logos.mjs (logo option A, issue #50). Do not edit.
// Geometry only: colours come from the design tokens where the paths are drawn.

/** Wordmark "Jeparla": letters plus the two faces of the baguette stone that is the "l". */
export const WORDMARK = {
  width: ${r(wa.w)},
  height: ${r(wa.h)},
  letters: "${wa.parts.letters}",
  faceL: "${wa.parts.faceL}",
  faceR: "${wa.parts.faceR}",
} as const;

/** Compact mark on a 64-unit tile: the J and the baguette stone. */
export const MARK = {
  size: 64,
  letters: "${ma.parts.letters}",
  faceL: "${ma.parts.faceL}",
  faceR: "${ma.parts.faceR}",
} as const;
`;
const appOut = join(here, "..", "..", "..", "frontend", "src", "components", "brand");
mkdirSync(appOut, { recursive: true });
writeFileSync(join(appOut, "logo-paths.ts"), ts);
console.log("written to", out, "and", appOut);
