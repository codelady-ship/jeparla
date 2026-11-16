import { getTranslations } from "next-intl/server";
import { AuthForm } from "@/components/auth/auth-form";
import { authLabels, authMetadata, AuthShell } from "@/components/auth/auth-page";
import { Link } from "@/i18n/navigation";

export const generateMetadata = () => authMetadata("register");

export default async function RegisterPage() {
  const t = await getTranslations("Auth");
  return (
    <AuthShell
      kind="register"
      footer={
        <>
          <p className="text-sm text-muted-foreground">
            {t.rich("register.legalNotice", {
              terms: (chunks) => (
                <Link href="/legal/terms" className="link-underline text-foreground">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href="/legal/privacy" className="link-underline text-foreground">
                  {chunks}
                </Link>
              ),
            })}
          </p>
          <p className="text-muted-foreground">
            {t("register.haveAccount")}{" "}
            <Link href="/login" className="link-underline font-medium text-foreground">
              {t("login.title")}
            </Link>
          </p>
          <p className="text-muted-foreground">
            {t("register.seller")}{" "}
            <Link
              href="/sell"
              prefetch={false}
              className="link-underline font-medium text-foreground"
            >
              {t("register.sellerLink")}
            </Link>
          </p>
        </>
      }
    >
      <AuthForm kind="register" labels={await authLabels("register")} />
    </AuthShell>
  );
}
