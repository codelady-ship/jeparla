"use client";

import { Share, SquarePlus } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  dismiss,
  isDismissed,
  isEngaged,
  isInstalled,
  isIosSafari,
  isStandalone,
  markInstalled,
  offerFor,
  productSlug,
  recordProductView,
  recordVisit,
  storage,
  type Offer,
} from "@/lib/pwa/install";

export type InstallLabels = {
  title: string;
  text: string;
  install: string;
  notNow: string;
  iosText: string;
  iosStep1: string;
  iosStep2: string;
  gotIt: string;
};

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Chrome can fire beforeinstallprompt before React hydrates, so it is caught as soon
// as this module loads. preventDefault() keeps Chrome's own mini bar away: we ask
// once, politely, at the right moment.
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    markInstalled(storage("localStorage"));
    emit();
  });
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
const canPrompt = () => deferred !== null;
const never = () => false;

/** The offer waits a moment after the page settles: it never competes with content. */
const SHOW_DELAY_MS = 1500;
const CLOSE_MS = 150;
/** Forms and work areas: an install offer there would interrupt. */
const QUIET_PAGES =
  /^\/[a-z]{2}\/(merchant|admin|login|register|forgot-password|sell|offline)(\/|$)/;

/**
 * "Add Jeparla to your home screen", after the visitor has shown interest (rules in
 * lib/pwa/install.ts). Android and desktop Chromium: our card, then the browser's own
 * install dialog. iPhone Safari: the two steps with Safari's icons.
 * A calm card above the bottom edge, never a modal: it does not take focus or block
 * the page. Escape or "Not now" dismisses it for good.
 */
export function InstallPrompt({ labels }: { labels: InstallLabels }) {
  const pathname = usePathname();
  const promptable = useSyncExternalStore(subscribe, canPrompt, never);
  const [offer, setOffer] = useState<Offer>(null);
  const [closing, setClosing] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  const textId = useId();

  useEffect(() => {
    recordVisit(storage("localStorage"), storage("sessionStorage"));
  }, []);

  useEffect(() => {
    const local = storage("localStorage");
    const slug = productSlug(pathname);
    if (slug) recordProductView(local, slug);
    const next = offerFor({
      engaged: isEngaged(local),
      dismissed: isDismissed(local),
      installed: isInstalled(local),
      standalone: isStandalone(window),
      canPrompt: promptable,
      iosSafari: isIosSafari(navigator.userAgent, navigator.maxTouchPoints),
    });
    if (!next) return;
    const timer = setTimeout(() => setOffer(next), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pathname, promptable]);

  function close() {
    // Focus inside the card would be lost when it unmounts: hand it to the page.
    if (ref.current?.contains(document.activeElement)) {
      document.getElementById("main")?.focus({ preventScroll: true });
    }
    setClosing(true);
    setTimeout(() => {
      setOffer(null);
      setClosing(false);
    }, CLOSE_MS);
  }

  function onDismiss() {
    dismiss(storage("localStorage"));
    close();
  }

  async function onInstall() {
    const event = deferred;
    if (!event) return close();
    // The event works once; the browser fires a new one if it can ask again.
    deferred = null;
    emit();
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "accepted") markInstalled(storage("localStorage"));
    else dismiss(storage("localStorage"));
    close();
  }

  const quiet = QUIET_PAGES.test(pathname);
  const show = offer === "ios" || (offer === "prompt" && (promptable || closing));
  if (!show || quiet) return null;

  const ios = offer === "ios";
  return (
    <aside
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={textId}
      data-closing={closing || undefined}
      onKeyDown={(e) => {
        if (e.key === "Escape") onDismiss();
      }}
      className="pwa-card fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-2xl border bg-card p-4 text-card-foreground shadow-xl shadow-foreground/10 before:pointer-events-none before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-linear-to-r before:from-transparent before:via-gold/70 before:to-transparent sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[24rem] sm:p-5 dark:shadow-black/40"
    >
      <div className="flex items-start gap-4">
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={48}
          height={48}
          unoptimized
          className="size-12 shrink-0 rounded-xl ring-1 ring-foreground/10"
        />
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-[1.375rem] leading-tight font-medium">
            {labels.title}
          </h2>
          <p id={textId} className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {ios ? labels.iosText : labels.text}
          </p>
        </div>
      </div>

      {ios && (
        <ol className="mt-3 flex flex-col gap-2 border-t pt-3 text-sm">
          {[
            { Icon: Share, text: labels.iosStep1 },
            { Icon: SquarePlus, text: labels.iosStep2 },
          ].map(({ Icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-gold-text">
                <Icon aria-hidden className="size-4" />
              </span>
              {text}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        {ios ? (
          <Button onClick={onDismiss} className="h-11 rounded-full px-5">
            {labels.gotIt}
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onDismiss} className="h-11 rounded-full px-4">
              {labels.notNow}
            </Button>
            <Button onClick={onInstall} className="h-11 rounded-full px-5">
              {labels.install}
            </Button>
          </>
        )}
      </div>
    </aside>
  );
}
