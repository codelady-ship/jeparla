import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import az from "../../messages/az.json";
import en from "../../messages/en.json";
import ru from "../../messages/ru.json";

/**
 * "How we verify" page (#107): no "100% guarantee" and no number that is not measured. The page
 * text lives in the Verified namespace only, so every string of it is checked in all three
 * languages. A real, enforced figure (for example a response time the team keeps) must be added
 * to ALLOWED_NUMBERS on purpose, together with where it is enforced.
 */
const ALLOWED_NUMBERS: string[] = [];
// The page says a check is NOT a full guarantee; these catch the opposite, a promise.
const PROMISES = [
  /100\s*%/,
  /\bwe guarantee\b/i,
  /\bguaranteed\b/i,
  /zəmanət veririk/i,
  /zəmanətlidir/i,
  /гарантируем/i,
  /гарантирован/i,
];

function strings(node: unknown, path = ""): [string, string][] {
  if (typeof node === "string") return [[path, node]];
  if (node && typeof node === "object")
    return Object.entries(node).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  return [];
}

describe.each([
  ["az", az],
  ["en", en],
  ["ru", ru],
])("Verified page texts (%s)", (_, messages) => {
  const texts = strings(messages.Verified);

  it("has the page texts", () => {
    expect(texts.length).toBeGreaterThan(10);
  });

  it("promises no guarantee", () => {
    for (const [path, text] of texts)
      for (const promise of PROMISES) expect(`${path}: ${text}`).not.toMatch(promise);
  });

  it("shows no number that is not measured", () => {
    for (const [path, text] of texts) {
      const numbers = (text.match(/\d+(?:[.,]\d+)?\s*%?/g) ?? []).map((n) => n.trim());
      expect(
        numbers.filter((n) => !ALLOWED_NUMBERS.includes(n)),
        path,
      ).toEqual([]);
    }
  });
});

describe("Verified page rendering", () => {
  it("is a Server Component with FAQPage JSON-LD, so it renders without JavaScript", () => {
    const page = readFileSync(join(process.cwd(), "src/app/[locale]/verified/page.tsx"), "utf8");
    expect(page).not.toMatch(/^\s*["']use client["']/m);
    expect(page).toContain("faqPage(");
  });
});
