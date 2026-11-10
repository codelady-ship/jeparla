"use client";

import { Check, Link2, Share } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { notices } from "@/lib/notice";
import { shareOrCopy } from "@/lib/share";
import { cn } from "cn";

export type ShareLabels = { share: string; copy: string; copied: string; copyFailed: string };

const COPIED_MS = 2000;

/**
 * "Share" on touch devices (system share sheet), "Copy link" elsewhere (clipboard and
 * a toast). Which label shows is decided by CSS (pointer: coarse), the same test the
 * click uses, so server and client render the same markup.
 *
 * Without `url` it shares the address bar as it is at click time, so a filtered
 * catalog shares its filters. A store's own catalog link (#100) passes `url`.
 */
export function ShareButton({
  labels,
  url,
  title,
  text,
  className,
}: {
  labels: ShareLabels;
  url?: string;
  title?: string;
  text?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function onClick() {
    const outcome = await shareOrCopy(
      { url: url ?? window.location.href, title: title ?? document.title, text },
      window,
    );
    if (outcome === "copied") {
      notices.show(labels.copied);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_MS);
    } else if (outcome === "failed") {
      notices.show(labels.copyFailed);
    }
  }

  const icon =
    "absolute inset-0 size-4 transition-[opacity,scale,filter] duration-200 ease-(--ease-luxe) motion-reduce:transition-none";
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      data-copied={copied || undefined}
      className={cn(
        "h-11 gap-2 rounded-full px-4 transition-[background-color,color,scale,translate] duration-150 active:scale-[0.97] sm:h-10",
        className,
      )}
    >
      <span aria-hidden className="relative size-4 text-gold-text">
        <Link2
          className={cn(
            icon,
            "group-data-copied/button:scale-50 group-data-copied/button:opacity-0 group-data-copied/button:blur-[2px] pointer-coarse:hidden",
          )}
        />
        <Share
          className={cn(
            icon,
            "hidden group-data-copied/button:scale-50 group-data-copied/button:opacity-0 group-data-copied/button:blur-[2px] pointer-coarse:block",
          )}
        />
        <Check
          className={cn(
            icon,
            "scale-50 opacity-0 blur-[2px] group-data-copied/button:scale-100 group-data-copied/button:opacity-100 group-data-copied/button:blur-none",
          )}
        />
      </span>
      <span className="pointer-coarse:hidden">{labels.copy}</span>
      <span className="hidden pointer-coarse:inline">{labels.share}</span>
    </Button>
  );
}
