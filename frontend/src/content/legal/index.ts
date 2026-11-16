import type { Locale } from "@/i18n/routing";
import az from "./az.json";
import en from "./en.json";
import ru from "./ru.json";
import {
  CONTACT_SECTION,
  LEGAL_DOCS,
  LEGAL_UPDATED,
  type LegalDoc,
  type LegalDocId,
  type LegalSection,
  OPERATOR_SECTION,
} from "./types";

export {
  CONTACT_SECTION,
  LEGAL_DOCS,
  LEGAL_UPDATED,
  type LegalDoc,
  type LegalDocId,
  type LegalSection,
  OPERATOR_SECTION,
};

/**
 * The texts are JSON next to this file (not in messages/): they are long, have lists, and are read only by the
 * server-rendered legal pages, so they never reach the client bundle. Same keys in every language
 * (src/lib/legal-texts.test.ts).
 */
const TEXTS: Record<Locale, Record<LegalDocId, LegalDoc>> = { az, en, ru };

export function legalDoc(locale: Locale, doc: LegalDocId): LegalDoc {
  return TEXTS[locale][doc];
}

export function isLegalDoc(id: string): id is LegalDocId {
  return (LEGAL_DOCS as string[]).includes(id);
}
