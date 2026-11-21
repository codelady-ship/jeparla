import type { ReactNode } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { clamp, easeOut, Heading, INK, SAFE, SAFE_W, useWindow } from "./kit";

/** Two-line heading above the phone (inside the safe area), shown between `from` and `to`. */
export function Caption({ from, to, children, color = INK, top = SAFE.top + 16, size = 70 }: { from: number; to: number; children: ReactNode; color?: string; top?: number; size?: number }) {
  const frame = useCurrentFrame();
  const o = useWindow(from, to, 8);
  const y = interpolate(frame, [from, from + 12], [26, 0], { ...clamp, easing: easeOut });
  if (frame < from || frame > to) return null;
  return (
    <div style={{ position: "absolute", left: SAFE.left, top, width: SAFE_W, opacity: o, transform: `translateY(${y}px)` }}>
      <Heading size={size} color={color}>
        {children}
      </Heading>
    </div>
  );
}
