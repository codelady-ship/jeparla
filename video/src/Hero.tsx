import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { loadFont } from "@remotion/google-fonts/Cormorant";
import {
  BACKDROP,
  ENTER,
  GOLD,
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

// Same heading face as the site (Cormorant), loaded at render time.
const { fontFamily } = loadFont("normal", { weights: ["500"], subsets: ["latin"] });

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
 * The brand word behind the animals: centred over them, its lower part hidden by
 * their heads. A shadow-dark ink, so it reads clearly on the cream. It rises in
 * during act 1 and dissolves at the start of act 2 (as the scroll begins).
 */
function Word({ f, frame }: { f: Format; frame: number }) {
  const span = (GROUP.right - GROUP.left) * f.scale;
  const size = (span * 1.05) / 3.1;
  const cx = f.x + ((GROUP.left + GROUP.right) / 2) * f.scale;
  const headTop = f.y + Math.min(...TIGERS.map((t) => t.top)) * f.scale;
  const enter = interpolate(frame, [4, 46], [0, 1], { ...clamp, easing: easeOut });
  const leave = interpolate(frame, [ENTER, ENTER + 14], [0, 1], { ...clamp, easing: easeInOut });
  return (
    <div
      style={{
        position: "absolute",
        left: cx - size * 2.5,
        width: size * 5,
        top: headTop - size * 0.55,
        textAlign: "center",
        fontFamily,
        fontWeight: 500,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: `${(1 - enter) * 0.08}em`,
        color: INK,
        opacity: enter * (1 - leave) * 0.2,
        transform: `translateY(${(1 - enter) * size * 0.25 - leave * size * 0.3}px)`,
        filter: `blur(${(1 - enter) * 14 + leave * 12}px)`,
        textShadow: `0 ${size * 0.05}px ${size * 0.1}px rgba(22, 37, 31, 0.55)`,
      }}
    >
      Jeparla
    </div>
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
