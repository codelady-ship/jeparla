"use client";

import { ChevronDown } from "lucide-react";
import { useId, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "cn";

type Props = { label: string; links: { href: string; label: string }[] };

/**
 * A header entry that opens a list of links below it: on hover with a mouse, on click or
 * tap, and from the keyboard (Enter or Space on the button, Escape closes and returns to it).
 * The links are always in the HTML; while closed they are invisible and not focusable.
 * Only opacity and transform move.
 */
export function HeaderMenu({ label, links }: Props) {
  const [open, setOpen] = useState(false);
  const hovering = useRef(false);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  const onKeyDown = (e: KeyboardEvent<HTMLLIElement>) => {
    if (e.key !== "Escape" || !open) return;
    setOpen(false);
    button.current?.focus();
  };
  const onBlur = (e: FocusEvent<HTMLLIElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
  };

  return (
    <li
      className="relative hidden lg:block"
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        hovering.current = true;
        setOpen(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse") return;
        hovering.current = false;
        setOpen(false);
      }}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        // Under a mouse the menu is already open from the hover: a click keeps it open.
        onClick={() => setOpen((o) => (hovering.current ? true : !o))}
        className="inline-flex cursor-pointer items-center gap-1 link-underline py-1"
      >
        {label}
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 transition-transform duration-(--duration-base) motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>
      {/* The top padding bridges the gap to the button, so the pointer never leaves the entry. */}
      <div
        id={id}
        className={cn(
          "absolute top-full -left-3 z-50 pt-3 transition-[opacity,translate,visibility] duration-(--duration-base) motion-reduce:transition-none",
          open ? "visible opacity-100" : "invisible -translate-y-1 opacity-0",
        )}
      >
        <ul className="flex min-w-60 flex-col rounded-lg bg-popover p-2 font-normal text-popover-foreground shadow-md ring-1 ring-foreground/10">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                prefetch={false}
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2 whitespace-nowrap hover:bg-muted focus-visible:bg-muted pointer-coarse:py-3"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}
