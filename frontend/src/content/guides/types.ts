/**
 * Guides (#63, PLAN 5.18): long-form answers to common jewelry questions. The body text
 * lives here as typed data, one file per language; only short UI labels are in
 * messages/*.json (namespace "Guides").
 *
 * Honesty rule (CLAUDE.md): only definitional facts and facts from the listed sources.
 * No prices, no statistics, no invented numbers. Every source is a page we opened.
 */

export const GUIDE_SLUGS = [
  "585-vs-750-gold",
  "gold-price-calculation",
  "diamond-4c",
  "hallmark-check",
  "silver-jewelry-care",
  "fineness-chart",
  "bijouterie-vs-precious",
  "gold-jewelry-care",
  "engagement-ring-buying",
] as const;

export type GuideSlug = (typeof GUIDE_SLUGS)[number];

/** Internal paths have no locale prefix ("/guides/diamond-4c"); external links are https URLs. */
export type GuideLink = { label: string; href: string };

export type GuideBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "links"; items: GuideLink[] }
  /** A small data table; the first cell of each row is the row header. */
  | { type: "table"; caption: string; head: string[]; rows: string[][] };

export type GuideSection = {
  /** Fragment id, stable across languages. */
  id: string;
  title: string;
  blocks: GuideBlock[];
};

export type GuideSource = {
  /** Title of the page as published. */
  title: string;
  publisher: string;
  url: string;
};

export type Guide = {
  slug: GuideSlug;
  title: string;
  /** Meta description and the card text on the index. */
  description: string;
  /** Short answer shown first, for readers and answer engines. */
  answer: string;
  sections: GuideSection[];
  sources: GuideSource[];
};

/** One language's text; slugs and sources are shared (see sources.ts). */
export type GuideText = Omit<Guide, "slug" | "sources">;

export type GuideTexts = Record<GuideSlug, GuideText>;
