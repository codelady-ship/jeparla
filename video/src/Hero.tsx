import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { WORDMARK } from "../../frontend/src/components/brand/logo-paths";
import {
  BACKDROP,
  ENTER,
  GOLD,
  GOLD_DEEP,
  GOLD_LIGHT,
  GROUP,
  INK,
  MODEL_ORDER,
  modelBox,
  SOURCE,
  TIGERS,
  TRANSFORM,
  walkFrame,
  type Format,
} from "./layout";


type Box = { left: number; top: number; width: number; height: number };

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeOut = Easing.bezier(0.2, 0.7, 0.1, 1);
const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

function Figure({ src, box, f, style }: { src: string; box: Box; f: Format; style?: React.CSSProperties }) {
  return (
    <Img
      src={staticFile(src)}
      style={{
        position: "absolute",
        left: f.x + box.left * f.scale,
        top: f.y + box.top * f.scale,
        width: box.width * f.scale,
        height: box.height * f.scale,
        ...style,
      }}
    />
  );
}

/** Soft contact shadow under the paws. */
function Shadow({ box, f, opacity }: { box: Box; f: Format; opacity: number }) {
  const w = box.width * f.scale * 0.95;
  return (
    <div
      style={{
        position: "absolute",
        left: f.x + (box.left + box.width / 2) * f.scale - w / 2,
        top: f.y + (box.top + box.height) * f.scale - w * 0.08,
        width: w,
        height: w * 0.16,
        borderRadius: "50%",
        background: "radial-gradient(closest-side, rgba(22,37,31,0.3), rgba(22,37,31,0))",
        opacity,
      }}
    />
  );
}

/**
 * The brand word behind the animals, written by hand as they walk in (owner, 2026-11-22):
 * the script wordmark of the site (frontend/src/components/brand/logo-paths.ts, generated
 * by docs/brand/src/build-logo-script.mjs) in a bold stroke, revealed left to right behind
 * a soft pen, then the ring is drawn on the J. Same look as the word above the models on
 * the site. Centred over the animals, its lower part hidden by their heads; it dissolves at
 * the start of act 2 (as the scroll begins).
 */
const FEATHER = 36;
const BOLD = 4;
function Word({ f, frame }: { f: Format; frame: number }) {
  const span = (GROUP.right - GROUP.left) * f.scale;
  const width = span * 0.95;
  const k = width / WORDMARK.width;
  const height = WORDMARK.height * k;
  const cx = f.x + ((GROUP.left + GROUP.right) / 2) * f.scale;
  const headTop = f.y + Math.min(...TIGERS.map((t) => t.top)) * f.scale;
  // Letters 6-70, ring 70-92, stone 88-96; a short hold, then it leaves with act 2.
  const pen = interpolate(frame, [6, 70], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const ringDraw = interpolate(frame, [70, 92], [0, 1], { ...clamp, easing: easeOut });
  const stone = interpolate(frame, [88, 96], [0, 1], clamp);
  const appear = interpolate(frame, [4, 10], [0, 1], clamp);
  const leave = interpolate(frame, [ENTER, ENTER + 14], [0, 1], { ...clamp, easing: easeInOut });
  const { ring } = WORDMARK;
  return (
    <svg
      viewBox={`0 0 ${WORDMARK.width} ${WORDMARK.height}`}
      style={{
        position: "absolute",
        left: cx - width / 2,
        // The baseline sits a little below the tallest head, as the word did before.
        top: headTop - height * 0.62,
        width,
        height,
        overflow: "visible",
        opacity: appear * (1 - leave),
        transform: `translateY(${-leave * height * 0.15}px)`,
        filter: `blur(${leave * 12}px) drop-shadow(0 ${4 * k}px ${8 * k}px rgba(22, 37, 31, 0.25))`,
      }}
    >
      <defs>
        <linearGradient id="pen-fade" x1="0" x2="1" y1="0" y2="0">
          <stop offset={WORDMARK.width / (WORDMARK.width + FEATHER)} stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <mask id="pen" maskUnits="userSpaceOnUse" x={-FEATHER} y={-20} width={WORDMARK.width + FEATHER * 2} height={WORDMARK.height + 40}>
          <rect
            x={(pen - 1) * (WORDMARK.width + FEATHER)}
            y={-20}
            width={WORDMARK.width + FEATHER}
            height={WORDMARK.height + 40}
            fill="url(#pen-fade)"
          />
        </mask>
      </defs>
      <path fill="none" stroke={GOLD_DEEP} strokeWidth={ring.stroke * 1.25} strokeLinecap="round"
        pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ringDraw} d={ring.back} />
      <path mask="url(#pen)" fill={INK} stroke={INK} strokeWidth={BOLD} strokeLinejoin="round" d={WORDMARK.letters} />
      <path fill="none" stroke={GOLD} strokeWidth={ring.stroke * 1.25} strokeLinecap="round"
        pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ringDraw} d={ring.front} />
      <path fill={GOLD_LIGHT} stroke={GOLD_DEEP} strokeWidth={ring.stoneStroke} strokeLinejoin="round"
        opacity={stone} d={ring.stone} />
    </svg>
  );
}

/** Act 1: the AI clip, cut out frame by frame, walking in on the site cream. */
function Walk({ f, frame }: { f: Format; frame: number }) {
  const k = walkFrame(frame);
  const appear = interpolate(frame, [0, 10], [0, 1], clamp);
  return (
    <Img
      src={staticFile(`walk/${String(k).padStart(3, "0")}.webp`)}
      style={{
        position: "absolute",
        left: f.x,
        top: f.y,
        width: SOURCE.w * f.scale,
        height: SOURCE.h * f.scale,
        opacity: appear,
      }}
    />
  );
}

export function Hero({ f }: { f: Format }) {
  const frame = useCurrentFrame();
  // Shadows settle in as the animals reach their marks.
  const arrive = interpolate(walkFrame(frame), [80, 120], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ background: BACKDROP, overflow: "hidden" }}>
      <Word f={f} frame={frame} />
      {frame < ENTER && (
        <>
          {TIGERS.map((box, i) => (
            <Shadow key={i} box={box} f={f} opacity={arrive} />
          ))}
          <Walk f={f} frame={frame} />
        </>
      )}
      {frame >= ENTER &&
        MODEL_ORDER.map((i) => {
          const box = TIGERS[i];
          // Act 2: gold light sweep reveals the model, the animal dissolves behind it.
          const t0 = ENTER + i * 12;
          const s = interpolate(frame, [t0, t0 + TRANSFORM - 32], [0, 1], { ...clamp, easing: easeInOut });
          const mb = modelBox(f, i);
          const mx = mb.left;
          const mw = mb.width;
          const beamTop = Math.min(f.y + box.top * f.scale, mb.top) - 40 * f.scale;
          // The beam crosses both the animal and the model, which do not stand on exactly
          // the same spot, so nothing of the animal is left when it has passed.
          const tx = f.x + box.left * f.scale;
          const tw = box.width * f.scale;
          const from = Math.min(mx, tx) - mw * 0.4;
          const to = Math.max(mx + mw, tx + tw) + mw * 0.4;
          const beamX = from + s * (to - from);
          // The reveal edge follows the beam core, so nothing changes ahead of the light.
          const cut = (left: number, width: number) => Math.min(Math.max((beamX - left) / width, 0), 1);
          const modelCut = cut(mx, mw);
          const tigerCut = cut(tx, tw);
          const beam = Math.sin(s * Math.PI);

          return (
            <AbsoluteFill key={i}>
              <Shadow box={box} f={f} opacity={1 - tigerCut} />
              <Figure
                src={`tiger-${i}.png`}
                box={box}
                f={f}
                style={{
                  opacity: 1 - tigerCut,
                  filter: `blur(${tigerCut * 3}px) brightness(${1 + beam * 0.25})`,
                  clipPath: `inset(0 0 0 ${tigerCut * 100}%)`,
                }}
              />
              <Img
                src={staticFile(`model-${i}.png`)}
                style={{
                  position: "absolute",
                  left: mb.left,
                  top: mb.top,
                  width: mb.width,
                  height: mb.height,
                  clipPath: `inset(0 ${(1 - modelCut) * 100}% 0 0)`,
                  // A fully clipped image can still leave a hairline: hide it until the sweep starts.
                  opacity: modelCut > 0 ? 1 : 0,
                  transform: `scale(${0.97 + s * 0.03})`,
                  transformOrigin: "50% 100%",
                  filter: `brightness(${1 + beam * 0.18})`,
                }}
              />
              {/* The light beam itself: a soft gold column with a bright core. */}
              <div
                style={{
                  position: "absolute",
                  left: beamX - mw * 0.22,
                  top: beamTop,
                  width: mw * 0.44,
                  height: f.height,
                  opacity: beam * 0.75,
                  background: `linear-gradient(90deg, transparent, ${GOLD} 32%, ${GOLD_LIGHT} 50%, ${GOLD} 68%, transparent)`,
                  filter: `blur(${14 * f.scale}px)`,
                  maskImage: "linear-gradient(180deg, transparent, #000 18%, #000 82%, transparent)",
                }}
              />
              {/* Bright core so the sweep reads as light, not paint. */}
              <div
                style={{
                  position: "absolute",
                  left: beamX - mw * 0.03,
                  top: beamTop,
                  width: mw * 0.06,
                  height: f.height,
                  opacity: beam,
                  background: "#FFF8E6",
                  filter: `blur(${6 * f.scale}px)`,
                  maskImage: "linear-gradient(180deg, transparent, #000 18%, #000 82%, transparent)",
                }}
              />
            </AbsoluteFill>
          );
        })}
    </AbsoluteFill>
  );
}
