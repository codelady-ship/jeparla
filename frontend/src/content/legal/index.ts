import type { Locale } from "@/i18n/routing";
import { az } from "./az";
import { en } from "./en";
import { ru } from "./ru";
import { LEGAL_DOCS, type LegalDoc, type LegalDocId } from "./types";

export { LEGAL_DOCS, type LegalDoc, type LegalDocId };

const CONTENT = { az, en, ru } as const;

export function isLegalDoc(id: string): id is LegalDocId {
  return (LEGAL_DOCS as string[]).includes(id);
}

export function legalDoc(locale: Locale, id: LegalDocId): LegalDoc {
  return CONTENT[locale][id];
}

/** Until the owner and a lawyer approve the texts (#57), the pages are drafts: banner and noindex. */
export const LEGAL_DRAFT = true;
