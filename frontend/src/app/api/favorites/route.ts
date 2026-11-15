import { forwardJson } from "@/lib/api/forward";

/**
 * Merges this browser's favourites, with the price each had when it was saved, into the
 * signed-in buyer's account and answers with the merged list (#112, POST
 * /api/v1/favorites/import). The backend validates the body and keeps the first saved price.
 */
export const POST = (request: Request) => forwardJson(request, "/favorites/import");
