"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** Mobile filter panel. Closes itself when the form inside is submitted. */
export function FiltersSheet({
  labels,
  count,
  children,
}: {
  labels: { open: string; title: string; close: string };
  count: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" className="lg:hidden" />}>
        <SlidersHorizontal aria-hidden />
        {labels.open}
        {count > 0 && (
          <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">
            {count}
          </span>
        )}
      </SheetTrigger>
      <SheetContent side="left" closeLabel={labels.close} className="w-[22rem] max-w-full">
        <SheetHeader>
          <SheetTitle>{labels.title}</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto px-4 pb-4" onSubmitCapture={() => setOpen(false)}>
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
