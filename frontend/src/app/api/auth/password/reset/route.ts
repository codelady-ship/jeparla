import { relayPublic } from "@/lib/auth/recovery-server";

export const POST = (request: Request) => relayPublic(request, "reset");
