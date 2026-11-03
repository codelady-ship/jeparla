"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Decides whether the header should hide for a scroll step (pure, unit tested). */
export function shouldHide(prevY: number, y: number, headerHeight: number, hasFocus: boolean) {
  return y > prevY && y > headerHeight * 2 && !hasFocus;
}

/**
 * Sticky header that slides away while scrolling down and returns on scroll up.
 * Only `transform` changes (no layout shift). Passive listener + rAF, the same
 * pattern as the scroll hero. Always visible near the top and while focused.
 */
export function HeaderShell({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let lastY = window.scrollY;
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const hide = shouldHide(lastY, y, el.offsetHeight, el.contains(document.activeElement));
      el.dataset.hidden = hide ? "true" : "false";
      lastY = y;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header
      ref={ref}
      data-hidden="false"
      className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-md transition-transform duration-(--duration-base) ease-(--ease-in-out) data-[hidden=true]:-translate-y-full motion-reduce:transition-none"
    >
      {children}
    </header>
  );
}
