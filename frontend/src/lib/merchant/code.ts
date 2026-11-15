/**
 * Seller code of conduct (#107): accepted in the /sell wizard and again once a year in the
 * cabinet. Without a valid acceptance the backend refuses to send products to review
 * (409 merchant.code_not_accepted), so the cabinet asks for it in time.
 */
export type CodeState =
  /** Accepted and valid for more than REMIND_DAYS. */
  | { kind: "valid"; acceptedAt: string; validUntil: string }
  /** Accepted, but it runs out within REMIND_DAYS: confirm again now. */
  | { kind: "due"; acceptedAt: string; validUntil: string }
  /** Never accepted, a new version, or the year is over. */
  | { kind: "missing" };

export const REMIND_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function codeState(
  store: { codeAcceptedAt?: string | null; codeValidUntil?: string | null },
  now: Date,
): CodeState {
  const { codeAcceptedAt: acceptedAt, codeValidUntil: validUntil } = store;
  if (!acceptedAt || !validUntil) return { kind: "missing" };
  const until = Date.parse(validUntil);
  if (Number.isNaN(until) || until <= now.getTime()) return { kind: "missing" };
  const kind = until - now.getTime() <= REMIND_DAYS * DAY_MS ? "due" : "valid";
  return { kind, acceptedAt, validUntil };
}
