import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { alternates } from "@/i18n/alternates";
import { routing } from "@/i18n/routing";
import { PASSWORD_MIN } from "@/lib/auth/schemas";
import type { AuthFormLabels } from "./auth-form";

export type AuthKind = "login" | "register" | "forgot";
const PATH: Record<AuthKind, string> = {
  login: "/login",
  register: "/register",
  forgot: "/forgot-password",
};

export async function authMetadata(kind: AuthKind): Promise<Metadata> {
  "use cache";
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Auth" });
  return {
    title: t(`${kind}.title`),
    description: t(`${kind}.description`),
    alternates: alternates(locale, PATH[kind]),
    robots: { index: false, follow: true },
  };
}

export async function authLabels(kind: AuthKind): Promise<AuthFormLabels> {
  const [t, messages] = await Promise.all([getTranslations("Auth"), getMessages()]);
  const auth = messages.Auth;
  return {
    fields: auth.fields,
    hints: kind === "register" ? { password: t("hints.password", { min: PASSWORD_MIN }) } : {},
    errors: {
      ...auth.errors,
      passwordShort: t("errors.passwordShort", { min: PASSWORD_MIN }),
    },
    submit: t(`${kind}.submit`),
    pending: t("pending"),
    showPassword: t("showPassword"),
    hidePassword: t("hidePassword"),
    sentNotice: kind === "forgot" ? t("forgot.notice") : undefined,
  };
}

/** Narrow centered card shared by the sign-in pages. */
export async function AuthShell({
  kind,
  children,
  footer,
}: {
  kind: AuthKind;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const t = await getTranslations("Auth");
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10 sm:py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl sm:text-4xl">{t(`${kind}.title`)}</h1>
        <p className="text-muted-foreground">{t(`${kind}.intro`)}</p>
      </div>
      <div className="rounded-lg border bg-card p-5 sm:p-6">{children}</div>
      {footer && <div className="flex flex-col gap-2 text-sm">{footer}</div>}
    </div>
  );
}
