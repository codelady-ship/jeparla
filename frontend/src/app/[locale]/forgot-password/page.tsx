import { getTranslations } from "next-intl/server";
import { AuthForm } from "@/components/auth/auth-form";
import { authLabels, authMetadata, AuthShell } from "@/components/auth/auth-page";
import { Link } from "@/i18n/navigation";

export const generateMetadata = () => authMetadata("forgot");

/** Placeholder: recovery by SMS or e-mail arrives with the backend (PLAN 5.5). */
export default async function ForgotPasswordPage() {
  const t = await getTranslations("Auth");
  return (
    <AuthShell
      kind="forgot"
      footer={
        <Link href="/login" className="self-start link-underline">
          {t("forgot.back")}
        </Link>
      }
    >
      <AuthForm kind="forgot" labels={await authLabels("forgot")} />
    </AuthShell>
  );
}
