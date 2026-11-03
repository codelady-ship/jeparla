"use client";

import {
  useEffect,
  useRef,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
} from "react";

type Props = Omit<HTMLAttributes<HTMLElement>, "style"> & {
  children: ReactNode;
  /** Position in a group; each step adds --reveal-stagger of delay. */
  index?: number;
  as?: ElementType;
  className?: string;
};

/**
 * Fades its content up once, the first time it scrolls into view.
 * Styles live in globals.css ([data-reveal]); reduced motion shows it at once.
 * Do not wrap the LCP element or anything visible on first paint.
 */
export function Reveal({ children, index = 0, as: Tag = "div", className, ...rest }: Props) {
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
      className={className}
      style={{ "--reveal-index": index } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
