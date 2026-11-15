import { forwardJson } from "@/lib/api/forward";

/** The seller accepts the current code of conduct (#107): the yearly confirmation in the cabinet. */
export const POST = (request: Request) =>
  forwardJson(request, "/merchant/store/code-acceptance", { body: null });
