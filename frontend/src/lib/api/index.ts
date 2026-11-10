import { liveApi } from "./live";
import { mockApi } from "./mock";
import { USING_MOCK } from "./mode";
import type { JeparlaApi } from "./types";

export type { JeparlaApi } from "./types";
export { USING_MOCK };

/** The only data entry point for pages: the real backend, or the labelled sample data. */
export const api: JeparlaApi = USING_MOCK ? mockApi : liveApi;
