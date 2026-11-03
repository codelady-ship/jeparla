"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";

type Props = {
  items: { href: string; label: string }[];
  labels: { menu: string; close: string; home: string };
};

// Labels come translated from the server component, so no messages ship for this.
export function MobileNav({ items, labels }: Props) {
  const [open, setOpen] = useState(false);

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
          <SheetTitle className="font-heading text-2xl">Jeparla</SheetTitle>
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
