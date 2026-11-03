import { httpApi } from "./http";
import { mockApi } from "./mock";
import type { JeparlaApi } from "./types";

export type { JeparlaApi } from "./types";

/**
 * The only data entry point for pages. Mock data until the backend is connected
 * (issue #41 flips the default); set NEXT_PUBLIC_USE_MOCK=false to use the REST API.
 */
export const api: JeparlaApi = process.env.NEXT_PUBLIC_USE_MOCK === "false" ? httpApi : mockApi;
