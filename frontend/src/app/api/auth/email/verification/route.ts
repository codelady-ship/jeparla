import { relayResend } from "@/lib/auth/recovery-server";

/** Sends the e-mail verification link again for the signed-in account (#131). */
export const POST = (request: Request) => relayResend(request);
