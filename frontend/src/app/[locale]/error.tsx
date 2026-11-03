"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations("Errors");

  useEffect(() => {
    // Sentry hook comes with #56; keep the digest visible in the console meanwhile.
    console.error(error);
  }, [error]);

  return (
    <section
      role="alert"
      className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center"
    >
      <h1 className="text-3xl font-semibold">{t("errorTitle")}</h1>
      <p className="text-muted-foreground">{t("errorText")}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => retry()}>
          <RotateCcw aria-hidden />
          {t("retry")}
        </Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          {t("backHome")}
        </Link>
      </div>
    </section>
  );
}
