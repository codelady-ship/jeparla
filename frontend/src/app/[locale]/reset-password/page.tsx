import { getTranslations } from "next-intl/server";
import { authLabels, authMetadata, AuthShell } from "@/components/auth/auth-page";
import { ResetPasswordView } from "@/components/auth/recovery";
import { USING_MOCK } from "@/lib/api";

export const generateMetadata = () => authMetadata("reset");

/**
 * New password from a reset link: /{locale}/reset-password#token=... (backend AccountLinks).
 * The page is static; the token stays in the browser (fragment) and is posted to the API.
 */
export default async function ResetPasswordPage() {
  const t = await getTranslations("Auth");
  return (
    <AuthShell
      kind="reset"
      footer={USING_MOCK && <p className="text-xs text-muted-foreground">{t("recoveryDemo")}</p>}
    >
      <ResetPasswordView
        labels={await authLabels("reset")}
        texts={{
          checking: t("reset.checking"),
          done: t("reset.done"),
          signIn: t("reset.signIn"),
          invalid: t("reset.invalid"),
          requestNew: t("reset.requestNew"),
        }}
      />
    </AuthShell>
  );
}
