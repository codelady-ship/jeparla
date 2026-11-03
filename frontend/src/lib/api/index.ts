import { httpApi } from "./http";
import { mockApi } from "./mock";
import type { JeparlaApi } from "./types";

export type { JeparlaApi } from "./types";

/** True while pages show invented demo data (stores, products, prices). */
export const USING_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";

/**
 * The only data entry point for pages. Mock data until the backend is connected
 * (issue #41 flips the default); set NEXT_PUBLIC_USE_MOCK=false to use the REST API.
 */
export const api: JeparlaApi = USING_MOCK ? mockApi : httpApi;
