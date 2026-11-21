import type { ReactNode } from "react";
import { AbsoluteFill, Easing, Img, interpolate, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import { loadFont } from "@remotion/google-fonts/Cormorant";
import { BACKDROP, GOLD, GOLD_LIGHT, GOLD_TEXT, INK } from "../../layout";

// Heading face of the site; latin-ext carries Ə, Ş, Ğ, İ.
export const { fontFamily: SERIF } = loadFont("normal", { weights: ["500", "600", "700"], subsets: ["latin", "latin-ext"] });
export const SANS = '"Segoe UI", system-ui, sans-serif';
export { BACKDROP, GOLD, GOLD_LIGHT, GOLD_TEXT, INK };
/** Cream text on the dark-green scenes. */
export const CREAM = BACKDROP;

export const SHORT = { width: 1080, height: 1920, fps: 30 };

/**
 * Safe area shared by Reels, Shorts and TikTok: the top 250 px (status bar, tabs), the bottom
 * 400 px (caption, audio, buttons) and the right 140 px (like/comment column) stay clear of text.
 */
export const SAFE = { top: 250, bottom: SHORT.height - 400, left: 64, right: SHORT.width - 140 };
export const SAFE_W = SAFE.right - SAFE.left;

export type Platform = "ig" | "yt" | "tt";
export type ShortProps = { platform: Platform };

/** Where the link is on each platform (the video never shows a URL). */
export const CTA: Record<Platform, string> = {
  ig: "Link bioda",
  tt: "Link profildə",
  yt: "Link kanalın səhifəsində",
};

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/** 0 -> 1 over `len` frames from `start`, eased. */
export function useIn(start: number, len = 16) {
  const frame = useCurrentFrame();
  return interpolate(frame, [start, start + len], [0, 1], { ...clamp, easing: easeOut });
}

/** Visible between `from` and `to` (scene frames) with short fades on both ends. */
export function useWindow(from: number, to: number, fade = 8) {
  const frame = useCurrentFrame();
  return interpolate(frame, [from, from + fade, to - fade, to], [0, 1, 1, 0], clamp);
}

/** Text that rises and fades in. */
export function Rise({ at, children, dy = 40, style }: { at: number; children: ReactNode; dy?: number; style?: React.CSSProperties }) {
  const p = useIn(at, 18);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * dy}px)`, ...style }}>{children}</div>;
}

export const Gold = ({ children, dark }: { children: ReactNode; dark?: boolean }) => (
  <span style={{ color: dark ? GOLD : GOLD_TEXT }}>{children}</span>
);

export function Heading({ children, size = 96, color = INK, style }: { children: ReactNode; size?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: size, lineHeight: 1.04, color, letterSpacing: -0.5, fontVariantNumeric: "lining-nums", ...style }}>
      {children}
    </div>
  );
}

export function Body({ children, size = 46, color = INK, style }: { children: ReactNode; size?: number; color?: string; style?: React.CSSProperties }) {
  return <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: size, lineHeight: 1.22, color, ...style }}>{children}</div>;
}

export function Kicker({ children, color = GOLD_TEXT }: { children: ReactNode; color?: string }) {
  return (
    <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 32, letterSpacing: 4, textTransform: "uppercase", color }}>{children}</div>
  );
}

export const Rule = ({ width = 110, color = GOLD }: { width?: number; color?: string }) => (
  <div style={{ width, height: 5, background: color, borderRadius: 3 }} />
);

/** Block placed inside the safe area. */
export function Safe({ top = SAFE.top + 20, children, style }: { top?: number; children: ReactNode; style?: React.CSSProperties }) {
  return <div style={{ position: "absolute", left: SAFE.left, top, width: SAFE_W, ...style }}>{children}</div>;
}

/** Cream background with a soft gold light, or the dark-green scene background. */
export function Backdrop({ dark = false }: { dark?: boolean }) {
  return dark ? (
    <AbsoluteFill style={{ background: `radial-gradient(110% 60% at 80% 10%, #2A4237, ${INK} 65%)` }} />
  ) : (
    <AbsoluteFill style={{ background: `radial-gradient(120% 70% at 85% 0%, ${GOLD_LIGHT}55, transparent 60%), ${BACKDROP}` }} />
  );
}

/** Small label on frames that show AI-made visuals (docs/credits.md: hero animals and models). */
export function AiTag({ top = SAFE.bottom - 70, left = SAFE.left, dark = false }: { top?: number; left?: number; dark?: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        padding: "8px 18px",
        borderRadius: 999,
        background: dark ? "rgba(22,37,31,0.72)" : "rgba(247,243,234,0.9)",
        color: dark ? CREAM : INK,
        fontFamily: SANS,
        fontWeight: 600,
        fontSize: 26,
        border: `2px solid ${GOLD}`,
      }}
    >
      AI ilə yaradılmış vizual
    </div>
  );
}

/** Note under a stock clip (docs/credits.md: decorative, not a Jeparla store or product). */
export function StockNote({ top, left = SAFE.left, dark = false }: { top: number; left?: number; dark?: boolean }) {
  return (
    <div style={{ position: "absolute", top, left, fontFamily: SANS, fontSize: 24, color: dark ? "rgba(247,243,234,0.75)" : "rgba(22,37,31,0.65)" }}>
      Dekorativ stok görüntü (Pexels)
    </div>
  );
}

/** A licensed stock clip in a rounded frame that slowly zooms. */
export function ClipCard({
  src,
  x,
  y,
  w,
  h,
  from,
  to,
  startFrom = 0,
}: {
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  from: number;
  to: number;
  startFrom?: number;
}) {
  const frame = useCurrentFrame();
  const o = useWindow(from, to, 10);
  const zoom = interpolate(frame, [from, to], [1.04, 1.14], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: 40,
        overflow: "hidden",
        opacity: o,
        boxShadow: "0 30px 80px rgba(22,37,31,0.35)",
        outline: `4px solid ${GOLD}`,
      }}
    >
      <OffthreadVideo
        src={staticFile(`social/shorts/${src}`)}
        muted
        startFrom={startFrom}
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})` }}
      />
    </div>
  );
}

/** Phone screen: 390x844 CSS px captures (1080x2338) at this width. */
export const PHONE_W = 480;
export const PHONE_H = Math.round((PHONE_W * 844) / 390);

/**
 * A phone frame with site screens (public/social/shorts/<name>.webp). Each screen slides in
 * from the right at its frame; the phone enters at `from` and leaves at `to`.
 */
export function Phone({
  screens,
  from,
  to,
  x = SAFE.left + (SAFE_W - PHONE_W) / 2,
  y = SAFE.bottom - PHONE_H - 14,
  ai,
}: {
  /** `focus`: point of the screen (0-1) that the camera slowly zooms into while the screen is shown. */
  screens: { name: string; at: number; focus?: [number, number]; zoomTo?: number }[];
  from: number;
  to: number;
  x?: number;
  y?: number;
  /** Frames during which an AI-made visual is on the screen. */
  ai?: [number, number];
}) {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [from, from + 20], [0, 1], { ...clamp, easing: easeOut });
  const exit = interpolate(frame, [to - 12, to], [0, 1], { ...clamp, easing: easeInOut });
  const showAi = ai ? frame >= ai[0] && frame < ai[1] : false;
  return (
    <div
      style={{
        position: "absolute",
        left: x - 12,
        top: y - 12,
        width: PHONE_W + 24,
        height: PHONE_H + 24,
        borderRadius: 58,
        background: INK,
        boxShadow: "0 40px 90px rgba(22,37,31,0.35)",
        opacity: enter * (1 - exit),
        transform: `translateY(${(1 - enter) * 160 - exit * 40}px) scale(${0.95 + enter * 0.05})`,
      }}
    >
      <div style={{ position: "absolute", inset: 12, borderRadius: 46, overflow: "hidden", background: BACKDROP }}>
        {screens.map((s, i) => {
          const next = screens[i + 1]?.at ?? 1e6;
          const p = i === 0 ? 1 : interpolate(frame, [s.at, s.at + 16], [0, 1], { ...clamp, easing: easeInOut });
          const leave = interpolate(frame, [next, next + 16], [0, 1], { ...clamp, easing: easeInOut });
          const end = Math.min(next, to);
          const zoom = s.focus ? interpolate(frame, [s.at + 18, Math.max(end, s.at + 19)], [1, s.zoomTo ?? 1.5], { ...clamp, easing: easeInOut }) : 1;
          if (frame < s.at - 1 && i > 0) return null;
          if (frame > next + 17) return null;
          return (
            <Img
              key={s.name}
              src={staticFile(`social/shorts/${s.name}.webp`)}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: PHONE_W,
                height: PHONE_H,
                transformOrigin: s.focus ? `${s.focus[0] * 100}% ${s.focus[1] * 100}%` : undefined,
                transform: `translateX(${(1 - p) * PHONE_W - leave * PHONE_W * 0.3}px) scale(${zoom})`,
              }}
            />
          );
        })}
      </div>
      {showAi ? <AiTag top={Math.round(PHONE_H * 0.62)} left={36} dark /> : null}
    </div>
  );
}

/** Numbered step or check row. */
export function Step({ n, title, text, at, dark = false }: { n: string; title: ReactNode; text?: ReactNode; at: number; dark?: boolean }) {
  const p = useIn(at, 18);
  return (
    <div style={{ display: "flex", gap: 30, alignItems: "flex-start", opacity: p, transform: `translateX(${(1 - p) * 80}px)` }}>
      <div
        style={{
          flex: "0 0 auto",
          width: 92,
          height: 92,
          borderRadius: 46,
          background: GOLD,
          color: INK,
          fontFamily: SERIF,
          fontWeight: 700,
          fontSize: 52,
          lineHeight: "92px",
          textAlign: "center",
        }}
      >
        {n}
      </div>
      <div style={{ paddingTop: 4 }}>
        <Heading size={70} color={dark ? CREAM : INK}>
          {title}
        </Heading>
        {text ? (
          <Body size={40} color={dark ? "rgba(247,243,234,0.85)" : "rgba(22,37,31,0.85)"} style={{ fontWeight: 500, marginTop: 10 }}>
            {text}
          </Body>
        ) : null}
      </div>
    </div>
  );
}

/** Closing card: wordmark, line, call to action for the platform. */
export function EndCard({ at, platform, line, extra }: { at: number; platform: Platform; line: ReactNode; extra?: ReactNode }) {
  const p = useIn(at, 20);
  return (
    <AbsoluteFill style={{ opacity: p }}>
      <Backdrop />
      <Safe top={560} style={{ transform: `translateY(${(1 - p) * 40}px)` }}>
        <Heading size={170} style={{ lineHeight: 1 }}>
          Jeparla
        </Heading>
        <div style={{ margin: "36px 0" }}>
          <Rule width={150} />
        </div>
        <Heading size={68} style={{ fontWeight: 500 }}>
          {line}
        </Heading>
        {extra ? <div style={{ marginTop: 34 }}>{extra}</div> : null}
        <div
          style={{
            marginTop: 64,
            display: "inline-block",
            padding: "22px 44px",
            borderRadius: 999,
            background: GOLD,
            fontFamily: SANS,
            fontWeight: 700,
            fontSize: 46,
            color: INK,
          }}
        >
          {CTA[platform]}
        </div>
      </Safe>
    </AbsoluteFill>
  );
}

/** Scene wrapper: fades a whole scene in and out. */
export function Scene({ from, to, children, fade = 10 }: { from: number; to: number; children: ReactNode; fade?: number }) {
  const o = useWindow(from, to, fade);
  const frame = useCurrentFrame();
  if (frame < from || frame > to) return null;
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
}
