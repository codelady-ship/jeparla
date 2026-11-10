import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BRAND_COLORS_JSON,
  buildBrandColors,
  buildCss,
  TOKENS_CSS,
  TOKENS_JSON,
} from "../../scripts/tokens.mjs";
import { AA, contrastRatio } from "./contrast";

type Tokens = {
  color: Record<"light" | "dark", Record<string, string>>;
  pairs: ([string, string] | [string, string, keyof typeof AA])[];
};

const tokens: Tokens = JSON.parse(readFileSync(TOKENS_JSON, "utf8"));
const flat: Record<string, string> = {};
for (const [theme, palette] of Object.entries(tokens.color)) {
  for (const [role, hex] of Object.entries(palette)) flat[`${theme}-${role}`] = hex;
}

describe("design tokens", () => {
  it("light and dark define the same roles", () => {
    expect(Object.keys(tokens.color.dark).sort()).toEqual(Object.keys(tokens.color.light).sort());
  });

  it.each(tokens.pairs)("%s on %s passes WCAG AA", (fg, bg, size: keyof typeof AA = "normal") => {
    expect(flat[fg], fg).toBeDefined();
    expect(flat[bg], bg).toBeDefined();
    expect(contrastRatio(flat[fg], flat[bg])).toBeGreaterThanOrEqual(AA[size]);
  });

  it("tokens.css is generated from tokens.json (run npm run tokens)", () => {
    expect(readFileSync(TOKENS_CSS, "utf8")).toBe(buildCss(tokens));
    expect(readFileSync(BRAND_COLORS_JSON, "utf8")).toBe(buildBrandColors(tokens));
  });
});
