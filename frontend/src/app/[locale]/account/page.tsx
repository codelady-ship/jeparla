import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { DeleteAccount } from "@/components/auth/delete-account";
import { IntlProvider } from "@/components/i18n/intl-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { alternates } from "@/i18n/alternates";
import { routing } from "@/i18n/routing";
import { readSession } from "@/lib/auth/server";

/** Private: nothing to index. */
export async function generateMetadata(): Promise<Metadata> {
  "use cache";
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Account" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: alternates(locale, "/account"),
    robots: { index: false, follow: true },
  };
}

async function Details({ locale }: { locale: (typeof routing.locales)[number] }) {
  const session = await readSession();
  if (!session) redirect(`/${locale}/login?next=/account`);
  const [t, m] = await Promise.all([
    getTranslations({ locale, namespace: "Account" }),
    getMessages({ locale }),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <dl className="grid gap-x-6 gap-y-2 rounded-lg border p-5 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">{t("name")}</dt>
        <dd className="font-medium break-words">{session.name}</dd>
        <dt className="text-muted-foreground">{t("contact")}</dt>
        <dd className="font-medium break-words">{session.email}</dd>
      </dl>
      <IntlProvider locale={locale} messages={{ Account: m.Account }}>
        <DeleteAccount />
      </IntlProvider>
    </div>
  );
}

/** The signed-in user's own account (#249): who is signed in, and self-service deletion. */
export default async function AccountPage() {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return null;
  const t = await getTranslations({ locale, namespace: "Account" });
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl sm:text-4xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
        <Details locale={locale} />
      </Suspense>
    </div>
  );
}
