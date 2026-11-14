"use client";

import { CircleCheck, CircleAlert, Loader2 } from "lucide-react";
import { useLocale } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { setSession, useSession } from "@/lib/auth/client";
import {
  requestPasswordReset,
  resetPassword,
  retryText,
  takeHashToken,
  verifyEmail,
  type VerifyOutcome,
} from "@/lib/auth/recovery";
import type { FieldErrors } from "@/lib/auth/schemas";
import { AuthForm, type AuthFormLabels } from "./auth-form";
import { ResendVerification, type ResendLabels } from "./resend-verification";

/**
 * Pages of #131: forgot password, new password from a link, email confirmation from a link.
 * Every text comes from the server page as labels (Auth namespace).
 */

/** Keeps the "try again after {time}" text of the last 429 in the form's error labels. */
function useRateLimitLabel(labels: AuthFormLabels) {
  const locale = useLocale();
  const template = useRef(labels.errors.rateLimitedUntil ?? labels.errors.server);
  const [text, setText] = useState<string | null>(null);
  const withRate: AuthFormLabels = text
    ? { ...labels, errors: { ...labels.errors, rateLimited: text } }
    : labels;
  const limited = (retryAfter: number | null): FieldErrors => {
    setText(retryText(template.current ?? "", retryAfter, locale));
    return { form: "rateLimited" };
  };
  return { labels: withRate, limited };
}

/** Same answer for every address: the page never tells whether an account exists. */
export function ForgotPasswordForm({ labels }: { labels: AuthFormLabels }) {
  const rate = useRateLimitLabel(labels);
  return (
    <AuthForm
      kind="forgot"
      labels={rate.labels}
      onValid={async ({ email }) => {
        const { outcome, retryAfter } = await requestPasswordReset(email ?? "");
        if (outcome === "sent") return null;
        if (outcome === "rateLimited") return rate.limited(retryAfter);
        if (outcome === "invalid") return { email: "emailInvalid" };
        return { form: outcome };
      }}
    />
  );
}

function Message({
  tone,
  children,
  action,
}: {
  tone: "success" | "error" | "busy";
  children: ReactNode;
  action?: ReactNode;
}) {
  const Icon = tone === "success" ? CircleCheck : tone === "error" ? CircleAlert : Loader2;
  return (
    <div className="flex flex-col gap-4">
      <p
        role={tone === "error" ? "alert" : "status"}
        className="flex items-start gap-3 text-sm leading-relaxed"
      >
        <Icon
          aria-hidden
          className={
            tone === "busy"
              ? "mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground"
              : tone === "error"
                ? "mt-0.5 size-4 shrink-0 text-destructive"
                : "mt-0.5 size-4 shrink-0 text-primary"
          }
        />
        <span>{children}</span>
      </p>
      {action}
    </div>
  );
}

const ACTION = `${buttonVariants({ size: "lg" })} h-11 w-full text-base`;

export type ResetTexts = {
  checking: string;
  done: string;
  signIn: string;
  invalid: string;
  requestNew: string;
};

/**
 * New password from a reset link. The token is read from the fragment and removed from the
 * address bar before anything else happens. After the change every session of the account
 * has ended on the backend, so the local session is dropped as well.
 */
export function ResetPasswordView({
  labels,
  texts,
}: {
  labels: AuthFormLabels;
  texts: ResetTexts;
}) {
  const rate = useRateLimitLabel(labels);
  const [state, setState] = useState<"checking" | "form" | "done" | "invalid">("checking");
  // undefined until read; a ref survives the dev-mode double effect (the fragment is gone by then).
  const token = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    if (token.current === undefined) token.current = takeHashToken();
    void Promise.resolve(token.current).then((t) => {
      if (live) setState(t ? "form" : "invalid");
    });
    return () => {
      live = false;
    };
  }, []);

  if (state === "checking") return <Message tone="busy">{texts.checking}</Message>;
  if (state === "done")
    return (
      <Message
        tone="success"
        action={
          <Link href="/login" className={ACTION}>
            {texts.signIn}
          </Link>
        }
      >
        {texts.done}
      </Message>
    );
  if (state === "invalid")
    return (
      <Message
        tone="error"
        action={
          <Link href="/forgot-password" className={ACTION}>
            {texts.requestNew}
          </Link>
        }
      >
        {texts.invalid}
      </Message>
    );
  return (
    <AuthForm
      kind="reset"
      labels={rate.labels}
      onValid={async ({ password }) => {
        const { outcome, retryAfter } = await resetPassword(token.current ?? "", password ?? "");
        if (outcome === "done") {
          // The route handler already ended the session cookies; the header follows.
          setSession(null);
          setState("done");
          return null;
        }
        if (outcome === "invalidToken") {
          setState("invalid");
          return null;
        }
        if (outcome === "rateLimited") return rate.limited(retryAfter);
        // The browser checked the same rules; a 400 here is a rule the form does not know.
        return { form: outcome === "invalid" ? "server" : outcome };
      }}
    />
  );
}

export type VerifyTexts = {
  checking: string;
  done: string;
  toHome: string;
  invalid: string;
  signInForNew: string;
  signIn: string;
  retry: string;
  rateLimited: string;
  network: string;
  server: string;
};

/** Confirms the address of a verification link; works signed in or not (another browser). */
export function VerifyEmailView({
  texts,
  resendLabels,
}: {
  texts: VerifyTexts;
  resendLabels: ResendLabels;
}) {
  const locale = useLocale();
  const session = useSession();
  const [result, setResult] = useState<{ outcome: VerifyOutcome | "checking"; retry?: string }>({
    outcome: "checking",
  });
  // undefined until read; a ref survives the dev-mode double effect (the fragment is gone by then).
  const token = useRef<string | null | undefined>(undefined);

  async function run() {
    if (!token.current) {
      setResult({ outcome: "invalidToken" });
      return;
    }
    setResult({ outcome: "checking" });
    const { outcome, retryAfter } = await verifyEmail(token.current);
    setResult({
      outcome,
      retry: outcome === "rateLimited" ? retryText(texts.rateLimited, retryAfter, locale) : "",
    });
  }

  useEffect(() => {
    let live = true;
    if (token.current === undefined) token.current = takeHashToken();
    void Promise.resolve().then(() => {
      if (live) void run();
    });
    return () => {
      live = false;
    };
    // Runs once: the token is single use.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signedIn = session.status === "ready" ? session.session : null;
  // The banner and the account show the new state without signing in again.
  useEffect(() => {
    if (result.outcome === "done" && signedIn && signedIn.emailVerified === false)
      setSession({ ...signedIn, emailVerified: true });
  }, [result.outcome, signedIn]);

  const { outcome } = result;
  if (outcome === "checking") return <Message tone="busy">{texts.checking}</Message>;
  if (outcome === "done")
    return (
      <Message
        tone="success"
        action={
          <Link href="/" className={ACTION}>
            {texts.toHome}
          </Link>
        }
      >
        {texts.done}
      </Message>
    );
  if (outcome === "invalidToken")
    return (
      <Message
        tone="error"
        action={
          signedIn ? (
            <ResendVerification labels={resendLabels} />
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              <p className="text-muted-foreground">{texts.signInForNew}</p>
              <Link href="/login" className={ACTION}>
                {texts.signIn}
              </Link>
            </div>
          )
        }
      >
        {texts.invalid}
      </Message>
    );
  return (
    <Message
      tone="error"
      action={
        <Button type="button" size="lg" className="h-11 text-base" onClick={() => void run()}>
          {texts.retry}
        </Button>
      }
    >
      {outcome === "rateLimited" ? result.retry : texts[outcome]}
    </Message>
  );
}
