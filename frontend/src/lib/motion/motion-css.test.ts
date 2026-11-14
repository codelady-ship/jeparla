import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Motion rules live in CSS; these checks keep them composite-only and switchable (#118).
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/** Body of the first block that starts with `head` (balanced braces). */
function block(head: string): string {
  const start = css.indexOf(head);
  if (start < 0) throw new Error(`missing: ${head}`);
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1);
  }
  throw new Error(`unbalanced: ${head}`);
}

describe("micro-animations", () => {
  it("switches every new animation off for reduced motion", () => {
    const reduced = block("@media (prefers-reduced-motion: reduce)");
    for (const cls of [".img-swap", ".press-icon", ".value-in", ".value-out"]) {
      expect(reduced).toContain(cls);
    }
  });

  it("animates only opacity and transform", () => {
    for (const head of [
      "@keyframes value-out",
      "@keyframes value-in",
      "@utility img-swap",
      "@utility press-icon",
    ]) {
      const props = [...block(head).matchAll(/^\s*([a-z-]+)\s*:/gm)].map((m) => m[1]);
      const animated = props.filter((p) => !["transition", "animation", "display"].includes(p));
      expect(
        animated.every((p) => p === "opacity" || p === "transform"),
        head,
      ).toBe(true);
    }
  });

  it("takes durations from the motion tokens", () => {
    for (const head of ["@utility img-swap", "@utility press-icon", "@utility value-in"]) {
      expect(block(head)).toMatch(/var\(--duration-[a-z]+\)/);
      expect(block(head)).not.toMatch(/\d+m?s\b/);
    }
  });
});
