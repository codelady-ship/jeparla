"use client";

import { MailWarning } from "lucide-react";
import { lazy, Suspense } from "react";
import { useSession } from "@/lib/auth/client";
import type { ResendLabels } from "./resend-verification";

// Only accounts with an unconfirmed address load the button code.
const ResendVerification = lazy(() =>
  import("./resend-verification").then((m) => ({ default: m.ResendVerification })),
);

/**
 * "Confirm your e-mail" reminder under the header (#131). Shown only when the session says the
 * address is not confirmed; guests, phone-only accounts and sample-data sessions (no flag) see
 * nothing. An unconfirmed account can still do everything (docs/RBAC.md), so this is a hint,
 * not a gate, and `detail` says so.
 */
export function VerifyEmailBanner({
  text,
  detail,
  resend,
}: {
  text: string;
  detail: string;
  resend: ResendLabels;
}) {
  const state = useSession();
  const session = state.status === "ready" ? state.session : null;
  if (session?.emailVerified !== false) return null;
  return (
    <aside aria-label={text} className="border-b bg-muted text-foreground">
      <div className="container-page flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5 text-sm">
        <MailWarning aria-hidden className="size-4 shrink-0 text-gold-text" />
        <p className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{text}</span>
          <span className="text-muted-foreground">{detail}</span>
        </p>
        <Suspense fallback={null}>
          <ResendVerification labels={resend} compact />
        </Suspense>
      </div>
    </aside>
  );
}
