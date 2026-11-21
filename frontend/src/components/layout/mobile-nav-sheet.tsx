"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import type { NavGroup } from "./nav-items";

export type MobileNavProps = {
  items: { href: string; label: string }[];
  /** "For buyers" and "For sellers" link groups, shown under the main links. */
  groups: NavGroup[];
  labels: { menu: string; close: string; home: string };
};

/** The menu sheet itself; loaded on first use by <MobileNav>. */
export default function MobileNavSheet({
  items,
  groups,
  labels,
  defaultOpen = false,
}: MobileNavProps & { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label={labels.menu} />
        }
      >
        <Menu aria-hidden />
      </SheetTrigger>
      <SheetContent side="left" closeLabel={labels.close} className="w-72 overflow-y-auto">
        <SheetHeader>
          <SheetTitle translate="no">
            <Wordmark />
          </SheetTitle>
        </SheetHeader>
        <nav aria-label={labels.menu} className="flex flex-col px-4">
          {[{ href: "/", label: labels.home }, ...items].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="border-b py-3 text-base font-medium"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {groups.map((g) => (
          <nav key={g.key} aria-label={g.title} className="flex flex-col px-4 pt-5">
            <h2 className="font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {g.title}
            </h2>
            {g.links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                prefetch={false}
                onClick={() => setOpen(false)}
                className="py-3 text-sm"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        ))}
        <div className="mt-auto p-4">
          <LocaleSwitcher />
        </div>
      </SheetContent>
    </Sheet>
  );
}
