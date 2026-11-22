import { Landmark, MessageCircle, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";

const NOTES = [
  { key: "stores", Icon: ShieldCheck },
  { key: "prices", Icon: Landmark },
  { key: "contact", Icon: MessageCircle },
] as const;

/**
 * Utility bar above the header on wide screens (owner's design, 2026-11-21): three short
 * facts about how Jeparla works on the left, the language on the right. It scrolls away
 * with the page; the sticky header below it stays. Only what is true of a catalog: no
 * delivery or round-the-clock promise, since stores sell and deliver, not Jeparla.
 * Above the header in the stack (z-50), so the language list opens over it.
 */
export function TopBar() {
  const t = useTranslations("TopBar");
  return (
    <div data-topbar="" className="relative z-50 hidden border-b bg-muted text-xs lg:block">
      <div className="container-page flex h-9 items-center justify-between gap-6">
        <ul className="flex items-center divide-x divide-border">
          {NOTES.map(({ key, Icon }) => (
            <li key={key} className="flex items-center gap-2 px-5 first:pl-0">
              <Icon aria-hidden className="size-3.5 shrink-0 text-gold-text" />
              {t(key)}
            </li>
          ))}
        </ul>
        <LocaleSwitcher compact align="end" />
      </div>
    </div>
  );
}
