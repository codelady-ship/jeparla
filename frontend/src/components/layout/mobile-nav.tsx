"use client";

import { Menu } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import type { MobileNavProps } from "./mobile-nav-sheet";

const load = () => import("./mobile-nav-sheet");
const MobileNavSheet = lazy(load);

/**
 * Phone menu button. The sheet (dialog, focus trap, portal) is a separate chunk that
 * loads when the button is touched, pointed at or focused, so it is not part of the
 * first page load (#160, mobile blocking time). Labels come translated from the server.
 */
export function MobileNav({ items, labels }: MobileNavProps) {
  const [armed, setArmed] = useState(false);

  const button = (
    <button
      type="button"
      className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "md:hidden")}
      aria-label={labels.menu}
      aria-haspopup="dialog"
      onPointerDown={() => void load()}
      onPointerEnter={() => void load()}
      onFocus={() => void load()}
      onClick={() => setArmed(true)}
    >
      <Menu aria-hidden />
    </button>
  );

  if (!armed) return button;
  return (
    <Suspense fallback={button}>
      <MobileNavSheet items={items} labels={labels} defaultOpen />
    </Suspense>
  );
}
