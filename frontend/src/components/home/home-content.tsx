import { Gem } from "lucide-react";
import { useTranslations } from "next-intl";

// Placeholder home page body. Real sections and the scroll hero come with #15 and #27.
export function HomeContent() {
  const t = useTranslations("Home");
  return (
    <section className="flex flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <Gem aria-hidden className="size-10 text-gold-text" />
      <h1 translate="no" className="text-4xl font-semibold tracking-tight">
        Jeparla
      </h1>
      <p className="max-w-md text-muted-foreground">{t("tagline")}</p>
    </section>
  );
}
