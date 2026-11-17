"use client";

import { SlidersHorizontal } from "lucide-react";
import { createContext, use, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FilterForm } from "./filter-form";

/*
 * The filter fields are rendered on the server once (#189). On wide screens they sit in
 * the sidebar and submit on every change; when the mobile sheet opens, the same fields
 * move into it through a portal and submit with the explicit button.
 */
type State = {
  open: boolean;
  setOpen: (open: boolean) => void;
  node: HTMLElement | null;
  setNode: (node: HTMLElement | null) => void;
};

const FiltersContext = createContext<State | null>(null);

function useFilters(): State {
  const state = use(FiltersContext);
  if (!state) throw new Error("FiltersProvider is missing");
  return state;
}

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [node, setNode] = useState<HTMLElement | null>(null);
  return <FiltersContext value={{ open, setOpen, node, setNode }}>{children}</FiltersContext>;
}

/** Where the fields live: the sidebar, or the mobile sheet while it is open. */
export function FilterSlot({ action, children }: { action: string; children: ReactNode }) {
  const { open, setOpen, node } = useFilters();
  if (open && node) {
    return createPortal(
      // Portal events bubble through the React tree, so the sheet closes from here. In the
      // bubble phase, after the form has navigated: closing in the capture phase unmounted
      // the form before its own onSubmit ran, and the browser dropped the submission.
      <div onSubmit={() => setOpen(false)}>
        <FilterForm action={action}>{children}</FilterForm>
      </div>,
      node,
    );
  }
  return (
    <FilterForm action={action} auto>
      {children}
    </FilterForm>
  );
}

/** Mobile filter panel. Closes itself when the form inside is submitted. */
export function FiltersSheet({
  labels,
  count,
}: {
  labels: { open: string; title: string; close: string };
  count: number;
}) {
  const { open, setOpen, setNode } = useFilters();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            className="lg:hidden pointer-coarse:h-11 pointer-coarse:px-3.5"
          />
        }
      >
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
        <div ref={setNode} className="overflow-y-auto px-4 pb-4" />
      </SheetContent>
    </Sheet>
  );
}
