import { liveApi } from "./live";
import { mockApi } from "./mock";
import type { JeparlaApi } from "./types";

export type { JeparlaApi } from "./types";

/**
 * True only when the sample data mode was switched on on purpose (NEXT_PUBLIC_USE_MOCK=true):
 * local demos, CI builds without a backend. Every page then shows the "Nümunə data" banner and
 * asks search engines not to index it. Anything else, including an unset variable, uses the
 * real backend (NEXT_PUBLIC_API_URL), so production never falls back to invented data silently.
 */
export const USING_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

/** The only data entry point for pages. */
export const api: JeparlaApi = USING_MOCK ? mockApi : liveApi;
