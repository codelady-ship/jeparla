"use client";

import { useEffect, useRef } from "react";
import { cn } from "cn";

/** Largest tilt, in degrees. */
const MAX = 14;
/** Share of the remaining distance covered per frame: a soft, spring-like follow. */
const EASE = 0.12;

/**
 * A gold ring with a diamond (our own drawing) that turns toward the pointer:
 * CSS 3D rotation with perspective, eased per frame, plus a highlight and a shadow
 * that move with it. The mouse is followed anywhere on the page while the ring is
 * on screen; on touch screens a drag across it tilts it. Transform and opacity only;
 * the loop stops when the ring has settled. Reduced motion: it stays still.
 * Decorative: hidden from assistive technology and never focusable.
 */
export function TiltRing({ className }: { className?: string }) {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const ring = stage.querySelector<HTMLElement>("[data-tilt]")!;
    const shine = stage.querySelector<HTMLElement>("[data-shine]")!;
    const shadow = stage.querySelector<HTMLElement>("[data-shadow]")!;

    let tx = 0;
    let ty = 0;
    let x = 0;
    let y = 0;
    let raf = 0;
    let onScreen = true;
    // The stage box, read once per scroll or resize rather than on every pointer move.
    let box: DOMRect | null = null;
    const forget = () => (box = null);

    const draw = () => {
      raf = 0;
      x += (tx - x) * EASE;
      y += (ty - y) * EASE;
      ring.style.transform = `rotateX(${(-y * MAX).toFixed(2)}deg) rotateY(${(x * MAX).toFixed(2)}deg)`;
      // The highlight slides against the tilt, as a fixed light would across the metal.
      shine.style.transform = `translate3d(${(-x * 30).toFixed(1)}%, ${(-y * 30).toFixed(1)}%, 48px)`;
      shine.style.opacity = String(0.55 + Math.hypot(x, y) * 0.35);
      shadow.style.transform = `translateX(${(-x * 12).toFixed(1)}%) scaleX(${(1 - Math.abs(y) * 0.15).toFixed(3)})`;
      if (Math.abs(tx - x) + Math.abs(ty - y) > 0.002) raf = requestAnimationFrame(draw);
    };
    const aim = (cx: number, cy: number) => {
      const r = (box ??= stage.getBoundingClientRect());
      const clamp = (v: number) => Math.max(-1, Math.min(1, v));
      tx = clamp((cx - (r.left + r.width / 2)) / Math.max(r.width, innerWidth / 3));
      ty = clamp((cy - (r.top + r.height / 2)) / Math.max(r.height, innerHeight / 3));
      if (!raf) raf = requestAnimationFrame(draw);
    };
    const onMove = (e: PointerEvent) => {
      if (!onScreen) return;
      // Mouse and pen: followed anywhere; touch: only a drag that starts on the ring.
      if (e.pointerType !== "touch" || (e.target instanceof Node && stage.contains(e.target))) {
        aim(e.clientX, e.clientY);
      }
    };
    const rest = () => {
      tx = ty = 0;
      if (!raf) raf = requestAnimationFrame(draw);
    };

    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([e]) => {
            onScreen = e.isIntersecting;
            forget();
          });
    io?.observe(stage);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", forget, { passive: true });
    window.addEventListener("resize", forget);
    stage.addEventListener("pointerup", rest);
    stage.addEventListener("pointercancel", rest);
    return () => {
      io?.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", forget);
      window.removeEventListener("resize", forget);
      stage.removeEventListener("pointerup", rest);
      stage.removeEventListener("pointercancel", rest);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={stageRef} aria-hidden className={cn("tilt-stage", className)}>
      <div data-shadow className="tilt-shadow" />
      <div data-tilt className="tilt-ring">
        <svg viewBox="0 0 200 200" className="tilt-band">
          <defs>
            <linearGradient id="tilt-gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="var(--scene-gold-light)" />
              <stop offset="0.45" stopColor="var(--scene-gold)" />
              <stop offset="1" stopColor="var(--scene-gold-deep)" />
            </linearGradient>
          </defs>
          {/* Back of the band, then the front half drawn again over it, lighter. */}
          <ellipse
            cx="100"
            cy="128"
            rx="68"
            ry="30"
            fill="none"
            stroke="var(--scene-gold-deep)"
            strokeWidth="13"
          />
          <path
            d="M32 128a68 30 0 0 0 136 0"
            fill="none"
            stroke="url(#tilt-gold)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <path d="M88 104l4-12h16l4 12z" fill="url(#tilt-gold)" />
        </svg>
        <svg viewBox="0 0 200 200" className="tilt-stone">
          <path
            d="M76 40h48l18 16-42 36-42-36z"
            fill="var(--scene-diamond)"
            stroke="var(--scene-silver-text)"
            strokeOpacity=".35"
            strokeWidth=".8"
          />
          <path d="M84 56l16-16 16 16-16 36z" fill="var(--scene-silver)" fillOpacity=".55" />
          <path
            d="M58 56h84M76 40l8 16 16-16 16 16 8-16M84 56l16 36 16-36"
            fill="none"
            stroke="var(--scene-silver-text)"
            strokeOpacity=".3"
            strokeWidth=".8"
          />
        </svg>
        <div data-shine className="tilt-shine" />
      </div>
    </div>
  );
}
