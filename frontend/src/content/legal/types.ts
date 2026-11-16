/**
 * Legal pages (#56, #57): privacy policy, terms of use, seller terms, cookie notice. The texts are in the
 * messages (namespace LegalDocs, az/en/ru) and describe what the code does today (what is stored, where, for how
 * long, which providers). Analysis and sources: docs/legal/analysis.md. The operator's legal name, VOEN and
 * address come from configuration (src/lib/operator.ts), never from the text.
 */
export type LegalDocId = "privacy" | "terms" | "sellers" | "cookies";

export type LegalSection = {
  heading: string;
  paragraphs?: string[];
  items?: string[];
};

export type LegalDoc = {
  title: string;
  description: string;
  /** In page order; the keys are stable anchors (e.g. /legal/privacy#retention). */
  sections: Record<string, LegalSection>;
};

export const LEGAL_DOCS: LegalDocId[] = ["privacy", "terms", "sellers", "cookies"];

/** Date of the texts in force; change it with every change of a legal text. */
export const LEGAL_UPDATED = "2026-11-16";

/** Sections followed by the operator's details and by the contact block. */
export const OPERATOR_SECTION = "operator";
export const CONTACT_SECTION = "contact";
