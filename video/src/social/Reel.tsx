import { AbsoluteFill, Audio, Easing, Img, interpolate, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import { loadFont } from "@remotion/google-fonts/Cormorant";
import { BACKDROP, GOLD, GOLD_LIGHT, GOLD_TEXT, INK } from "../layout";

// Heading face of the site; latin-ext carries the Azerbaijani letters (Ə, Ş, Ğ ...).
const { fontFamily } = loadFont("normal", { weights: ["500", "600"], subsets: ["latin", "latin-ext"] });
const SANS = '"Segoe UI", system-ui, sans-serif';

export const REEL = { width: 1080, height: 1920, fps: 30, duration: 441 };

/**
 * Local assets in public/social/ (gitignored): the owner's clip (enhanced to 1080x1920,
 * 30 fps, 14.7 s) and 720px-wide full-page screenshots of the site at a 390px phone.
 */
export type ReelProps = { voice?: string };

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/** Timeline in frames (30 fps). Tune to the voice file once it exists. */
const T = {
  q: [6, 54, 102],
  shrink: 165,
  shrinkLen: 26,
  home: 190,
  store: 228,
  product: 268,
  wa: 300,
  metal: 336,
  end: 392,
};

// Corner box of the clip after it shrinks (9:16, like the frame).
const PIP = { x: 712, y: 1231, w: 320 };
// Phone screen: 390x844 CSS px shown at 600px wide.
const PHONE = { x: 60, y: 120, w: 600, h: Math.round((600 * 844) / 390) };
/** Screenshot px (1080-wide capture) to screen px. */
const k = PHONE.w / 1080;

function Question({ text, from, start, top, align }: { text: string; from: "top" | "right" | "left"; start: number; top: number; align: "center" | "left" | "right" }) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [start, start + 18], [0, 1], { ...clamp, easing: easeOut });
  const out = interpolate(frame, [T.shrink - 6, T.shrink + 6], [1, 0], clamp);
  const d = (1 - p) * 520;
  const tx = from === "right" ? d : from === "left" ? -d : 0;
  const ty = from === "top" ? -d : 0;
  const side = align === "center" ? { left: 0, right: 0, margin: "0 auto" } : align === "left" ? { left: 56 } : { right: 56 };
  return (
    <div
      style={{
        position: "absolute",
        top,
        ...side,
        width: "fit-content",
        padding: "22px 40px 26px",
        borderRadius: 30,
        background: "rgba(247,243,234,0.94)",
        boxShadow: "0 18px 50px rgba(22,37,31,0.22)",
        borderLeft: `8px solid ${GOLD}`,
        fontFamily,
        fontWeight: 600,
        fontSize: 74,
        lineHeight: 1.05,
        color: INK,
        transform: `translate(${tx}px, ${ty}px) rotate(${(1 - p) * (from === "left" ? -4 : 4)}deg)`,
        opacity: Math.min(p * 1.6, 1) * out,
      }}
    >
      {text}
    </div>
  );
}

/** Caption under the phone: max 2 lines, key word in gold. */
function Caption({ start, end, children }: { start: number; end: number; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [start, start + 8, end - 6, end], [0, 1, 1, 0], clamp);
  const y = interpolate(frame, [start, start + 10], [24, 0], { ...clamp, easing: easeOut });
  return (
    <div style={{ position: "absolute", left: 60, top: 1490, width: 620, fontFamily: SANS, fontWeight: 700, fontSize: 54, lineHeight: 1.18, color: INK, opacity: o, transform: `translateY(${y}px)` }}>
      {children}
    </div>
  );
}

const Gold = ({ children }: { children: React.ReactNode }) => <span style={{ color: GOLD_TEXT }}>{children}</span>;

/** One full-page screenshot inside the phone, scrolled by `y` (capture px). */
function Page({ src, y, opacity }: { src: string; y: number; opacity: number }) {
  return (
    <Img
      src={staticFile(`social/${src}.webp`)}
      style={{ position: "absolute", left: 0, top: 0, width: PHONE.w, transform: `translateY(${-y * k}px)`, opacity }}
    />
  );
}

function Phone() {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [T.shrink + 6, T.shrink + 30], [0, 1], { ...clamp, easing: easeOut });
  const exit = interpolate(frame, [T.end, T.end + 16], [0, 1], { ...clamp, easing: easeInOut });
  const fade = (a: number, b: number) => interpolate(frame, [a, a + 8, b, b + 8], [0, 1, 1, 0], clamp);
  const scroll = (pts: number[], ys: number[]) => interpolate(frame, pts, ys, { ...clamp, easing: easeInOut });

  const storeY = scroll([T.store + 10, T.product - 4], [0, 520]);
  const productY = scroll([T.product + 6, T.wa, T.metal, T.metal + 30], [0, 2465 - 820, 2465 - 820, 6097 - 260]);
  // Gold ring around the WhatsApp button while the voice says "yaz".
  const ring = interpolate(frame, [T.wa, T.wa + 8, T.metal - 4, T.metal + 2], [0, 1, 1, 0], clamp);
  const pulse = 1 + 0.04 * Math.sin((frame - T.wa) / 4);

  return (
    <div
      style={{
        position: "absolute",
        left: PHONE.x - 14,
        top: PHONE.y - 14,
        width: PHONE.w + 28,
        height: PHONE.h + 28,
        borderRadius: 66,
        background: INK,
        boxShadow: "0 40px 90px rgba(22,37,31,0.35)",
        transform: `translateY(${(1 - enter) * 180 + exit * -60}px) scale(${0.94 + enter * 0.06 - exit * 0.06})`,
        opacity: enter * (1 - exit),
      }}
    >
      <div style={{ position: "absolute", inset: 14, borderRadius: 52, overflow: "hidden", background: BACKDROP }}>
        <Page src="home" y={0} opacity={fade(T.shrink - 8, T.store)} />
        <Page src="store" y={storeY} opacity={fade(T.store, T.product)} />
        <Page src="product" y={productY} opacity={fade(T.product, 9999)} />
        <div
          style={{
            position: "absolute",
            left: 22,
            right: 22,
            top: (2465 - productY) * k - 14,
            height: 72,
            borderRadius: 20,
            border: `5px solid ${GOLD}`,
            boxShadow: `0 0 0 10px rgba(197,161,90,0.25)`,
            opacity: ring,
            transform: `scale(${pulse})`,
          }}
        />
      </div>
    </div>
  );
}

function Presenter() {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [T.shrink, T.shrink + T.shrinkLen], [0, 1], { ...clamp, easing: easeInOut });
  const s = 1 + (PIP.w / REEL.width - 1) * p;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: REEL.width,
        height: REEL.height,
        transformOrigin: "0 0",
        transform: `translate(${PIP.x * p}px, ${PIP.y * p}px) scale(${s})`,
        borderRadius: (44 * p) / s,
        overflow: "hidden",
        outline: p > 0 ? `${(6 * p) / s}px solid ${GOLD}` : undefined,
        boxShadow: p > 0 ? `0 ${30 / s}px ${70 / s}px rgba(22,37,31,${0.3 * p})` : undefined,
      }}
    >
      <OffthreadVideo src={staticFile("social/presenter.mp4")} muted style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

function Wordmark() {
  const frame = useCurrentFrame();
  const side = interpolate(frame, [T.shrink + 14, T.shrink + 36], [0, 1], { ...clamp, easing: easeOut });
  const end = interpolate(frame, [T.end + 6, T.end + 26], [0, 1], { ...clamp, easing: easeOut });
  return (
    <>
      <div style={{ position: "absolute", left: PIP.x, top: 150, width: PIP.w, opacity: side * (1 - end), transform: `translateY(${(1 - side) * 30}px)` }}>
        <div style={{ fontFamily, fontWeight: 600, fontSize: 88, color: INK, lineHeight: 1 }}>Jeparla</div>
        <div style={{ width: 90, height: 4, background: GOLD, margin: "22px 0" }} />
        <div style={{ fontFamily: SANS, fontSize: 34, lineHeight: 1.3, color: INK }}>Zərgər mağazaları bir saytda</div>
      </div>
      <div style={{ position: "absolute", left: 60, top: 470, width: 620, opacity: end, transform: `translateY(${(1 - end) * 40}px)` }}>
        <div style={{ fontFamily, fontWeight: 600, fontSize: 150, color: INK, lineHeight: 1 }}>Jeparla</div>
        <div style={{ width: 140, height: 5, background: GOLD, margin: "34px 0" }} />
        <div style={{ fontFamily, fontWeight: 500, fontSize: 64, lineHeight: 1.15, color: INK }}>Parıltının hər çaları bir yerdə.</div>
        <div style={{ marginTop: 60, display: "inline-block", padding: "20px 38px", borderRadius: 999, background: GOLD, fontFamily: SANS, fontWeight: 700, fontSize: 44, color: INK }}>
          Link bioda
        </div>
      </div>
    </>
  );
}

export function Reel({ voice }: ReelProps) {
  const frame = useCurrentFrame();
  const bg = interpolate(frame, [T.shrink, T.shrink + 12], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: BACKDROP }}>
      <AbsoluteFill style={{ opacity: bg, background: `radial-gradient(120% 70% at 85% 0%, ${GOLD_LIGHT}55, transparent 60%), ${BACKDROP}` }} />
      <Phone />
      <Wordmark />
      <Presenter />
      <Question text="Qızıl üzük axtarırsan?" from="top" start={T.q[0]} top={96} align="center" />
      <Question text="Hansı mağazada var?" from="right" start={T.q[1]} top={1080} align="right" />
      <Question text="Qiyməti nə qədərdir?" from="left" start={T.q[2]} top={1300} align="left" />
      <Caption start={T.shrink + T.shrinkLen - 4} end={T.store}>
        <Gold>Jeparla</Gold> saytına gir.
      </Caption>
      <Caption start={T.store} end={T.metal}>
        Mağazanı seç, məhsula bax, <Gold>WhatsApp</Gold> ilə yaz.
      </Caption>
      <Caption start={T.metal} end={T.end + 4}>
        Qızılın <Gold>bugünkü qiyməti</Gold> də orada.
      </Caption>
      {voice ? <Audio src={staticFile(voice)} /> : null}
    </AbsoluteFill>
  );
}
