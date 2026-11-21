"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";

export type MobileNavProps = {
  items: { href: string; label: string }[];
  labels: { menu: string; close: string; home: string };
};

/** The menu sheet itself; loaded on first use by <MobileNav>. */
export default function MobileNavSheet({
  items,
  labels,
  defaultOpen = false,
}: MobileNavProps & { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="md:hidden" aria-label={labels.menu} />
        }
      >
        <Menu aria-hidden />
      </SheetTrigger>
      <SheetContent side="left" closeLabel={labels.close} className="w-72">
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
        <div className="mt-auto p-4">
          <LocaleSwitcher />
        </div>
      </SheetContent>
    </Sheet>
  );
}
