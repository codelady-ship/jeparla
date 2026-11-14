import { forwardJson } from "@/lib/api/forward";

/** Marks every notification of the signed-in user read. */
export const POST = (request: Request) =>
  forwardJson(request, "/notifications/read-all", { body: {} });
