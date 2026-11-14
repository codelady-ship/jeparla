import { getTranslations } from "next-intl/server";
import { authLabels, authMetadata, AuthShell } from "@/components/auth/auth-page";
import { ForgotPasswordForm } from "@/components/auth/recovery";
import { Link } from "@/i18n/navigation";
import { USING_MOCK } from "@/lib/api";

export const generateMetadata = () => authMetadata("forgot");

/**
 * Asks for a reset link by e-mail (#131). The answer is the same whether or not an account
 * has the address. Phone-only sellers get their link from an administrator (no SMS yet).
 */
export default async function ForgotPasswordPage() {
  const t = await getTranslations("Auth");
  return (
    <AuthShell
      kind="forgot"
      footer={
        <>
          <p className="text-muted-foreground">{t("forgot.phone")}</p>
          <Link href="/login" className="self-start link-underline">
            {t("forgot.back")}
          </Link>
          {USING_MOCK && <p className="text-xs text-muted-foreground">{t("recoveryDemo")}</p>}
        </>
      }
    >
      <ForgotPasswordForm labels={await authLabels("forgot")} />
    </AuthShell>
  );
}
