/**
 * True only when the sample data mode was switched on on purpose (NEXT_PUBLIC_USE_MOCK=true):
 * local demos, CI builds without a backend. Every page then shows the "Nümunə data" banner and
 * asks search engines not to index it. Anything else, including an unset variable, uses the
 * real backend (NEXT_PUBLIC_API_URL), so production never falls back to invented data silently.
 * Kept in its own module so the proxy can read it without the server cache code.
 */
export const USING_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";
