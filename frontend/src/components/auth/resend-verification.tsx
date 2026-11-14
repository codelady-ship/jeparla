"use client";

import { Loader2, MailCheck } from "lucide-react";
import { useLocale } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { setSession, useSession } from "@/lib/auth/client";
import { resendVerification, retryText, type ResendOutcome } from "@/lib/auth/recovery";

export type ResendLabels = {
  button: string;
  pending: string;
  sent: string;
  alreadyVerified: string;
  noEmail: string;
  signIn: string;
  unavailable: string;
  /** Holds {time}. */
  rateLimited: string;
  network: string;
  server: string;
};

/** "Send the link again" for the signed-in account (backend limit: 3 per hour). */
export function ResendVerification({
  labels,
  compact = false,
}: {
  labels: ResendLabels;
  compact?: boolean;
}) {
  const locale = useLocale();
  const session = useSession();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ outcome: ResendOutcome; text: string } | null>(null);

  async function send() {
    setPending(true);
    const { outcome, retryAfter } = await resendVerification();
    setPending(false);
    setResult({
      outcome,
      text:
        outcome === "rateLimited"
          ? retryText(labels.rateLimited, retryAfter, locale)
          : labels[outcome],
    });
    // Already confirmed elsewhere (another browser): the reminder can go.
    const s = session.status === "ready" ? session.session : null;
    if (outcome === "alreadyVerified" && s) setSession({ ...s, emailVerified: true });
  }

  const ok = result?.outcome === "sent" || result?.outcome === "alreadyVerified";
  return (
    <div
      className={compact ? "flex flex-wrap items-center gap-x-3 gap-y-1" : "flex flex-col gap-3"}
    >
      {!(result?.outcome === "sent") && (
        <Button
          type="button"
          variant={compact ? "outline" : "default"}
          size={compact ? "sm" : "lg"}
          className={compact ? "pointer-coarse:h-11" : "h-11 text-base"}
          disabled={pending}
          onClick={() => void send()}
        >
          {pending ? <Loader2 aria-hidden className="animate-spin" /> : <MailCheck aria-hidden />}
          {pending ? labels.pending : labels.button}
        </Button>
      )}
      <p
        role={ok ? "status" : "alert"}
        className={ok ? "text-sm" : "text-sm text-destructive"}
        hidden={!result}
      >
        {result?.text}
      </p>
    </div>
  );
}
