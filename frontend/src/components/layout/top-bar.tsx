import { Gem, Headset, Landmark, MessageCircle, ShieldCheck, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "cn";

type Note = {
  key: "stores" | "prices" | "contact" | "quality" | "support";
  Icon: LucideIcon;
  /** The page the note opens: where to do it, or the page that explains it. */
  href: string;
  /** From which width the note shows: the bar holds as many as fit. */
  show?: string;
};

const NOTES: Note[] = [
  { key: "contact", Icon: MessageCircle, href: "/stores" },
  { key: "quality", Icon: Gem, href: "/verified" },
  { key: "support", Icon: Headset, href: "/help" },
  { key: "prices", Icon: Landmark, href: "/prices", show: "hidden xl:flex" },
  { key: "stores", Icon: ShieldCheck, href: "/stores", show: "hidden 2xl:flex" },
];

/**
 * Utility bar above the header on wide screens (owner's design, 2026-11-21): short notes
 * about how Jeparla works; each opens the page where it is done or explained. It
 * scrolls away with the page; the sticky header below it stays. No delivery or
 * round-the-clock promise: stores sell and deliver, not Jeparla.
 */
export function TopBar() {
  const t = useTranslations("TopBar");
  return (
    <div data-topbar="" className="relative z-50 hidden border-b bg-surface-warm text-xs lg:block">
      <ul className="container-page flex h-9 items-center divide-x divide-border">
        {NOTES.map(({ key, Icon, href, show }) => (
          <li key={key} className={cn("items-center px-5 first:pl-0", show ?? "flex")}>
            <Link
              href={href}
              prefetch={false}
              className="inline-flex items-center gap-2 link-underline"
            >
              <Icon aria-hidden className="size-3.5 shrink-0 text-gold-text" />
              {t(key)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
