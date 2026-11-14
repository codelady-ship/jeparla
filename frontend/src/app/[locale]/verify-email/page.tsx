import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { authMetadata, AuthShell, resendLabels } from "@/components/auth/auth-page";
import { VerifyEmailView } from "@/components/auth/recovery";
import { USING_MOCK } from "@/lib/api";

export const generateMetadata = () => authMetadata("verify");

/** Confirms an e-mail address from a link: /{locale}/verify-email#token=... (backend AccountLinks). */
export default async function VerifyEmailPage() {
  const [t, messages] = await Promise.all([getTranslations("Auth"), getMessages()]);
  return (
    <AuthShell
      kind="verify"
      footer={USING_MOCK && <p className="text-xs text-muted-foreground">{t("recoveryDemo")}</p>}
    >
      <VerifyEmailView
        texts={{
          checking: t("verify.checking"),
          done: t("verify.done"),
          toHome: t("verify.toHome"),
          invalid: t("verify.invalid"),
          signInForNew: t("verify.signInForNew"),
          signIn: t("login.submit"),
          retry: t("verify.retry"),
          rateLimited: messages.Auth.errors.rateLimitedUntil,
          network: t("errors.network"),
          server: t("errors.server"),
        }}
        resendLabels={await resendLabels(await getLocale())}
      />
    </AuthShell>
  );
}
