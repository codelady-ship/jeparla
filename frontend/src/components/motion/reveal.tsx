"use client";

import {
  useEffect,
  useRef,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
} from "react";

/**
 * Where the content comes from (globals.css, [data-reveal-from]):
 * - "up" (default): rises 24px and fades in.
 * - "left" / "right": slides in 40px from that side on wide screens (the two halves of a
 *   split section meet in the middle); rises on phones.
 * - "film": nothing fades; a film band's picture widens (<VideoBand>) where the browser
 *   cannot tie that to the scroll itself.
 * A `.reveal-frame` inside any of them (a picture panel) opens from a slightly smaller
 * window while the picture in it settles.
 */
export type RevealFrom = "up" | "left" | "right" | "film";

type Props = Omit<HTMLAttributes<HTMLElement>, "style"> & {
  children: ReactNode;
  /** Position in a group; each step adds --reveal-stagger of delay. */
  index?: number;
  from?: RevealFrom;
  /**
   * The element itself stays put; its [data-reveal-item] descendants come in one after
   * another from `from` (a list of links, cards, a block of copy). Each item's step is
   * its position among its siblings, or `--reveal-item` set on it.
   */
  stagger?: boolean;
  as?: ElementType;
  className?: string;
};

/**
 * Brings its content in once, the first time it scrolls into view.
 * Styles live in globals.css ([data-reveal]): hidden only once the layout's inline script
 * has marked <html>, so without JS, and with reduced motion, it is shown at once.
 * Do not wrap the LCP element or anything visible on first paint.
 */
export function Reveal({
  children,
  index = 0,
  from = "up",
  stagger = false,
  as: Tag = "div",
  className,
  ...rest
}: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = () => el.setAttribute("data-reveal", "shown");
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      show();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          show();
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      {...rest}
      ref={ref}
      data-reveal="hidden"
      data-reveal-from={from === "up" ? undefined : from}
      data-reveal-stagger={stagger ? "" : undefined}
      className={className}
      style={{ "--reveal-index": index } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
