"use client";

import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

/** Small "what does this mean" button next to a jewellery term (#174). */
export function TermHint({
  term,
  label,
  text,
}: {
  term: string;
  /** Accessible name of the button, e.g. "What is fineness?" */
  label: string;
  text: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={label}
        className="touch-target relative ml-1 inline-flex size-5 items-center justify-center rounded-full align-middle text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Info aria-hidden className="size-4" />
      </PopoverTrigger>
      <PopoverContent side="top">
        <PopoverTitle>{term}</PopoverTitle>
        <PopoverDescription>{text}</PopoverDescription>
      </PopoverContent>
    </Popover>
  );
}
