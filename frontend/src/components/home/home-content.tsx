import { Gem } from "lucide-react";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function HomeContent() {
  const t = useTranslations();
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <Gem aria-hidden className="size-10 text-gold-text" />
      <h1 className="text-4xl font-semibold tracking-tight">Jeparla</h1>
      <p className="max-w-md text-muted-foreground">{t("Home.tagline")}</p>
      <div className="flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle
          labels={{ toDark: t("Common.themeToDark"), toLight: t("Common.themeToLight") }}
        />
      </div>
    </main>
  );
}
