/**
 * Legal pages (#56): privacy policy, terms of use, cookie notice. DRAFTS: the factual parts describe what
 * the code does today (what is stored, which providers); every legal statement (legal basis, retention,
 * liability, jurisdiction, the operator's identity) is a `review` placeholder for the owner and an Azerbaijani
 * lawyer (#57). The pages are noindex and carry a draft banner until the owner approves the text.
 */
export type LegalDocId = "privacy" | "terms" | "cookies";

export type LegalSection = {
  heading: string;
  paragraphs?: string[];
  items?: string[];
  /** What the owner or the lawyer must write or confirm here; shown as a visible placeholder. */
  review?: string;
};

export type LegalDoc = {
  title: string;
  description: string;
  sections: LegalSection[];
};

export type LegalContent = Record<LegalDocId, LegalDoc>;

export const LEGAL_DOCS: LegalDocId[] = ["privacy", "terms", "cookies"];
