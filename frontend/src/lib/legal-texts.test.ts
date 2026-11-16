import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import az from "@/content/legal/az.json";
import en from "@/content/legal/en.json";
import ru from "@/content/legal/ru.json";
import { CONTACT_SECTION, LEGAL_DOCS, LEGAL_UPDATED, OPERATOR_SECTION } from "@/content/legal";
import { SESSION_MAX_AGE } from "@/lib/auth/session";
import { operatorDetails } from "@/lib/operator";

/**
 * Legal pages (#57, docs/legal/analysis.md): final texts, no draft markers, no promise of a guarantee, every
 * number is a period or a law reference the code or the analysis backs, and the periods that the code enforces
 * match the code.
 */

// Periods and references the texts may name, with where each is enforced or sourced:
// 3 (years: documents, reports; analysis.md 5), 5 (working days: refusal, law art. 12.6), 7 (working days: answer,
// law art. 12.4; days: session cookie, SESSION_MAX_AGE; years: declaration pseudonymisation, V56 and
// DeclarationRetentionProperties; years: audit log), 14 (days: backups, docker/backup; days: exchange, consumer
// law art. 15), 15 (days: notice of changes), 18 (age), 30 (days: refresh token, application.yml; longest abuse
// counter, RateLimitPolicy; notice of fees), 90 (days: refresh family; rejected documents), 2010 and 998 (the
// law's date and number), 8.1, 9.6.1, 11, 14 (articles of the personal data law).
const ALLOWED_NUMBERS = new Set([
  "3",
  "5",
  "7",
  "8.1",
  "9.6.1",
  "11",
  "14",
  "15",
  "18",
  "30",
  "90",
  "998",
  "2010",
]);

const PROMISES = [
  /100\s*%/,
  /\bwe guarantee\b/i,
  /\bguaranteed\b/i,
  /zəmanət veririk/i,
  /zəmanətlidir/i,
  /гарантируем/i,
  /гарантирован/i,
];

// ("Draft" itself is a product feature the texts name: seller drafts of products.)
const DRAFT_MARKERS = [
  /hüquqşünas/i,
  /\blawyer\b/i,
  /юрист/i,
  /qüvvədə deyil/i,
  /not in force/i,
  /təsdiq gözlənilir/i,
  /awaiting review/i,
  /sahibin məlumatı/i,
  /\[owner/i,
  /TODO/,
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
])("legal texts (%s)", (_, content) => {
  const docs = content as Record<string, { sections: Record<string, unknown> }>;
  const texts = strings(docs);

  it("has the same keys and list lengths as az", () => {
    const shape = (node: unknown): unknown =>
      Array.isArray(node)
        ? node.length
        : node && typeof node === "object"
          ? Object.fromEntries(Object.entries(node).map(([k, v]) => [k, shape(v)]))
          : typeof node;
    expect(shape(docs)).toEqual(shape(az));
    for (const [path, text] of texts) expect(text.trim(), path).not.toBe("");
  });

  it("has every document with its sections", () => {
    expect(Object.keys(docs).sort()).toEqual([...LEGAL_DOCS].sort());
    for (const id of ["privacy", "terms", "sellers"]) {
      expect(Object.keys(docs[id].sections), id).toContain(OPERATOR_SECTION);
      expect(Object.keys(docs[id].sections), id).toContain(CONTACT_SECTION);
    }
  });

  it("is final: no draft or placeholder markers in the text", () => {
    for (const [path, text] of texts)
      for (const marker of DRAFT_MARKERS) expect(`${path}: ${text}`).not.toMatch(marker);
  });

  it("promises no guarantee", () => {
    for (const [path, text] of texts)
      for (const promise of PROMISES) expect(`${path}: ${text}`).not.toMatch(promise);
  });

  it("names only backed numbers", () => {
    for (const [path, text] of texts) {
      // Digits inside names (Cloudflare R2, SHA-256) are not figures.
      const numbers = (text.match(/(?<![\p{L}\p{N}.-])\d+(?:\.\d+)*/gu) ?? []).filter(
        (n) => !ALLOWED_NUMBERS.has(n),
      );
      expect(numbers, `${path}: ${text}`).toEqual([]);
    }
  });

  it("matches the periods the code enforces", () => {
    const cookies = strings(docs.cookies).map(([, t]) => t);
    const sessionDays = SESSION_MAX_AGE / 86_400;
    expect(
      cookies.some((t) => t.startsWith("jeparla_session") && t.includes(` ${sessionDays} `)),
    ).toBe(true);
    const retention = strings((docs.privacy.sections as Record<string, unknown>).retention)
      .map(([, t]) => t)
      .join(" ");
    // V56 / DeclarationRetentionProperties: 7 years; docker/backup: 14 days.
    expect(retention).toContain(" 7 ");
    expect(retention).toContain("14");
  });
});

describe("legal page", () => {
  const page = readFileSync(join(process.cwd(), "src/app/[locale]/legal/[doc]/page.tsx"), "utf8");

  it("is indexable and renders without JavaScript", () => {
    expect(page).not.toMatch(/^\s*["']use client["']/m);
    expect(page).not.toMatch(/index:\s*false/);
    expect(page).toContain("webPage(");
  });

  it("has a valid date", () => {
    expect(LEGAL_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(LEGAL_UPDATED))).toBe(false);
  });
});

describe("operatorDetails", () => {
  it("is empty when nothing is configured, so the page shows the owner's-details marker", () => {
    expect(operatorDetails("", undefined, "  ")).toEqual({
      name: null,
      taxId: null,
      address: null,
    });
  });

  it("keeps configured values and ignores a VOEN that is not 10 digits", () => {
    expect(operatorDetails(" Jeparla MMC ", "1234 567 890", "Baku")).toEqual({
      name: "Jeparla MMC",
      taxId: "1234567890",
      address: "Baku",
    });
    expect(operatorDetails("X", "12345", "Y").taxId).toBeNull();
  });
});
