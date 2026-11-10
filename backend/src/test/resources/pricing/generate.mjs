// Parity fixtures for PricingEngineParityTests (#44): the results of frontend/src/lib/pricing.ts
// (big.js) for a table of inputs. The backend PricingEngine must return exactly the same strings.
//
// Run from the repository root after changing pricing.ts or this table:
//
//   node backend/src/test/resources/pricing/generate.mjs
//
// Needs Node 23.6+ (TypeScript type stripping) and frontend/node_modules (npm ci in frontend/; only
// big.js is loaded). In a git worktree without node_modules, point to another checkout:
//   JEPARLA_FRONTEND_NODE_MODULES=/path/to/jeparla/frontend/node_modules node .../generate.mjs
//
// Output: backend/src/test/resources/pricing/pricing-cases.json (deterministic, committed).
// Every input is a decimal string built from integers; no floating point value reaches pricing.ts.
import { registerHooks } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../../..");
const src = path.join(root, "frontend", "src");
const nodeModules = process.env.JEPARLA_FRONTEND_NODE_MODULES ?? path.join(root, "frontend", "node_modules");

// Bare packages (big.js) resolve from frontend/node_modules.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith(".") && !specifier.startsWith("node:") && !specifier.includes(":")
        && !specifier.startsWith("@/")) {
      const parentURL = pathToFileURL(path.join(path.dirname(nodeModules), "package.json")).href;
      return nextResolve(specifier, { ...context, parentURL });
    }
    return nextResolve(specifier, context);
  },
});

const { gramPrice, metalLinkedBreakdown, percentChange } = await import(
  pathToFileURL(path.join(src, "lib/pricing.ts")).href
);

// Deterministic integers (32-bit LCG), so the table is the same on every run.
let seed = 20261110;
const next = (n) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed % n;
};
/** An integer with `scale` implied decimals, as a decimal string: dec(12345, 2) = "123.45". */
const dec = (units, scale) => {
  const s = String(units).padStart(scale + 1, "0");
  return scale === 0 ? s : `${s.slice(0, -scale)}.${s.slice(-scale)}`;
};

const rule = (over = {}) => ({
  laborPerGram: "0",
  laborFixed: "0",
  stonePrice: "0",
  markupPercent: "0",
  minPrice: null,
  maxPrice: null,
  ...over,
});

// Real CBAR quotes (AZN per troy ounce) from the bulletins in src/test/resources/cbar/ and the demo seed.
const OUNCES = [
  "3110.34768", "7000.00", "85.00", "2900.00", "2500.00",
  "6877.435", "87.6642", "2580.175", "1741.1145",
  "7034.7105", "6720.542", "6670.1795", "6796.43", "7419.31",
  "0.0001", "1", "99999.9999",
];
const FINENESSES = [375, 500, 585, 583, 750, 875, 900, 916, 925, 950, 958, 999, 1000];

const gramPrices = [];
for (const ounce of OUNCES) gramPrices.push({ ounce, gram: gramPrice(ounce) });
for (let i = 0; i < 60; i++) {
  const ounce = dec(1 + next(99_999_999), 4);
  gramPrices.push({ ounce, gram: gramPrice(ounce) });
}

const changes = [
  ["100", "101.25"], ["200", "197"], ["0", "5"], ["6796.43", "6670.1795"], ["6670.1795", "6720.542"],
  ["6720.542", "7034.7105"], ["7034.7105", "6877.435"], ["100", "110.05"], ["100", "110.04"], ["100", "89.95"],
  ["7000.00", "7700.00"], ["7000.00", "7703.50"],
].map(([from, to]) => ({ from, to, change: percentChange(from, to) }));

const linked = [];
const add = (name, weightGrams, fineness, pureGramPrice, r) => {
  const b = metalLinkedBreakdown({ weightGrams, fineness, pureGramPrice, rule: r });
  linked.push({ name, weightGrams, fineness, pureGramPrice, rule: r, breakdown: b });
};

// The shared examples of frontend/src/lib/pricing.test.ts.
add("pure metal value", "3", 585, "200", rule());
add("labor, stone and markup", "3.250", 750, "225.0547",
  rule({ laborPerGram: "12", laborFixed: "20", stonePrice: "400", markupPercent: "15" }));
add("seller minimum", "1", 585, "200", rule({ minPrice: "150.00" }));
add("seller maximum", "1", 585, "200", rule({ maxPrice: "100.00" }));
add("tiny value rounds down", "0.1", 999, "0.15", rule());
add("float trap 0.125 + 0.2", "1", 1000, "0.125", rule({ laborFixed: "0.2" }));

// Rounding edges: exactly half a cent rounds up (away from zero); just below rounds down.
add("x.xx5 rounds up", "1", 1000, "0.125", rule());
add("1.005 rounds up (1.00 in binary floating point)", "1", 1000, "1.005", rule());
add("2.675 rounds up (2.67 in binary floating point)", "1", 1000, "2.675", rule());
add("1.0049999 rounds down", "1", 1000, "1.0049999", rule());
add("fractions of a cent from labor", "0.001", 1000, "0.0001", rule({ laborFixed: "0.01", laborPerGram: "4.99" }));
add("half a cent from labor per gram", "0.500", 1000, "1", rule({ laborPerGram: "0.01" }));
add("half a cent from markup", "1", 1000, "10", rule({ markupPercent: "0.05" }));
add("markup with 2 decimals", "2.345", 585, "225.0552", rule({ markupPercent: "12.35" }));

// Clamps: on the limit, just inside, both limits, the minimum alone wins below.
add("raw equals minimum", "1", 1000, "150", rule({ minPrice: "150.00" }));
add("raw a cent above minimum", "1", 1000, "150.01", rule({ minPrice: "150.00" }));
add("raw equals maximum", "1", 1000, "100", rule({ maxPrice: "100.00" }));
add("between both limits", "1", 1000, "120.555", rule({ minPrice: "100.00", maxPrice: "200.00" }));
add("below both limits", "1", 1000, "50", rule({ minPrice: "100.00", maxPrice: "200.00" }));
add("above both limits", "1", 1000, "500", rule({ minPrice: "100.00", maxPrice: "200.00" }));
add("equal limits", "1", 1000, "500", rule({ minPrice: "300.00", maxPrice: "300.00" }));
add("zero minimum, raw below half a cent", "1", 1000, "0.004", rule({ minPrice: "0.00" }));
add("maximum with more decimals than cents", "1", 1000, "500", rule({ maxPrice: "199.995" }));

// Real quotes of the CBAR bulletin of 06.11.2026 (fixture), one per metal.
add("gold 585 at the 06.11.2026 quote", "3.250", 585, gramPrice("6877.435"),
  rule({ laborPerGram: "15", laborFixed: "25", stonePrice: "0", markupPercent: "10" }));
add("silver 925 at the 06.11.2026 quote", "12.400", 925, gramPrice("87.6642"),
  rule({ laborPerGram: "3", laborFixed: "10", markupPercent: "20" }));
add("platinum 950 at the 06.11.2026 quote", "5.100", 950, gramPrice("2580.175"),
  rule({ laborPerGram: "20", stonePrice: "1200", markupPercent: "8", maxPrice: "3000.00" }));
add("palladium 950 at the 06.11.2026 quote", "4.000", 950, gramPrice("1741.1145"),
  rule({ laborFixed: "40", markupPercent: "5.5", minPrice: "400.00" }));
add("largest weight", "99999.999", 1000, gramPrice("99999.9999"), rule());

// Deterministic random table within the column limits (weight 8,3; money 12,2; markup 5,2).
for (let i = 0; i < 400; i++) {
  const weight = dec(1 + next(150_000), 3);
  const fineness = FINENESSES[next(FINENESSES.length)];
  const ounce = OUNCES[next(14)];
  const r = rule({
    laborPerGram: dec(next(5_000), 2),
    laborFixed: dec(next(20_000), 2),
    stonePrice: next(3) === 0 ? dec(next(500_000), 2) : "0.00",
    markupPercent: dec(next(4) === 0 ? 0 : next(5_000), 2),
  });
  const limit = next(5);
  if (limit === 1 || limit === 3) r.minPrice = dec(next(300_000), 2);
  if (limit === 2 || limit === 3) {
    const min = r.minPrice === null ? 0 : Number.parseInt(r.minPrice.replace(".", ""), 10);
    r.maxPrice = dec(min + next(500_000), 2);
  }
  add(`random ${i + 1}`, weight, fineness, gramPrice(ounce), r);
}

const out = path.join(here, "pricing-cases.json");
fs.writeFileSync(
  out,
  `${JSON.stringify({ generatedBy: "backend/src/test/resources/pricing/generate.mjs", gramPrices, changes, linked }, null, 2)}\n`,
);
console.log(`${gramPrices.length} gram prices, ${changes.length} changes, ${linked.length} METAL_LINKED cases written to ${path.relative(root, out)}`);
