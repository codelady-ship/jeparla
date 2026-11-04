import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { authLabels, authMetadata, AuthShell } from "@/components/auth/auth-page";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { USING_MOCK } from "@/lib/api";

export const generateMetadata = () => authMetadata("login");

type SP = PageProps<"/[locale]/login">["searchParams"];

async function LoginForm({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const next = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  return <AuthForm kind="login" labels={await authLabels("login")} next={next} />;
}

export default async function LoginPage({ searchParams }: PageProps<"/[locale]/login">) {
  const t = await getTranslations("Auth");
  return (
    <AuthShell
      kind="login"
      footer={
        <>
          <Link href="/forgot-password" className="self-start link-underline">
            {t("login.forgot")}
          </Link>
          <p className="text-muted-foreground">
            {t("login.noAccount")}{" "}
            <Link href="/register" className="link-underline font-medium text-foreground">
              {t("register.title")}
            </Link>
          </p>
          {USING_MOCK && <p className="text-xs text-muted-foreground">{t("demoNote")}</p>}
        </>
      }
    >
      {/* The next param is request data, so only the form streams; the shell is static. */}
      <Suspense fallback={<Skeleton className="h-52 w-full" />}>
        <LoginForm searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
