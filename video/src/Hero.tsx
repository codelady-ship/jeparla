import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { loadFont } from "@remotion/google-fonts/Cormorant";
import { BACKDROP, ENTER, GOLD, GOLD_LIGHT, INK, MODELS, TIGERS, TRANSFORM, type Format } from "./layout";

// Same heading face as the site (Cormorant), loaded at render time.
const { fontFamily } = loadFont("normal", { weights: ["500"], subsets: ["latin"] });

type Box = { left: number; top: number; width: number; height: number };

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeOut = Easing.bezier(0.2, 0.7, 0.1, 1);
const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/**
 * How each animal walks in: all three face the camera and come toward it, from the
 * back-left (white tiger), straight from the back (golden tiger) and the back-right
 * (black panther). x is a share of the frame width, lift a share of the animal's height.
 */
const ENTRIES = [
  { start: 0, from: { x: -0.32, scale: 0.5, lift: -0.3 } },
  { start: 14, from: { x: 0, scale: 0.4, lift: -0.38 } },
  { start: 7, from: { x: 0.32, scale: 0.5, lift: -0.3 } },
];
const WALK = 74; // frames each animal walks
const STRIDES = 5; // left+right step pairs over the walk
/** Where the legs start, as a share of the figure height from the top. */
const KNEE = 0.6;

/**
 * Walk cycle from walk progress p (0..1): the gait phase follows distance, so the
 * steps slow down with the approach and the last step settles to a stand.
 */
function gait(p: number) {
  const g = p * STRIDES * 2 * Math.PI;
  const amp = Math.min(1, (1 - p) * 3.5);
  return {
    left: Math.max(0, Math.sin(g)) * amp, // 0..1 lift of the left leg pair
    right: Math.max(0, -Math.sin(g)) * amp,
    roll: Math.sin(g) * amp, // shoulders roll toward the planted side
    bob: Math.abs(Math.sin(g)) * amp, // body rises mid-stride
  };
}

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
function Shadow({ box, f, opacity, scale }: { box: Box; f: Format; opacity: number; scale: number }) {
  const w = box.width * f.scale * 0.95;
  return (
    <div
      style={{
        position: "absolute",
        left: f.x + (box.left + box.width / 2) * f.scale - w / 2,
        top: f.y + (box.top + box.height) * f.scale - w * 0.07,
        width: w,
        height: w * 0.14,
        borderRadius: "50%",
        background: "radial-gradient(closest-side, rgba(22,37,31,0.32), rgba(22,37,31,0))",
        opacity,
        transform: `scale(${scale})`,
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
  const span = (1007 - 275) * f.scale;
  const size = (span * 1.12) / 3.1;
  const cx = f.x + 641 * f.scale;
  const headTop = f.y + Math.min(...TIGERS.map((t) => t.top)) * f.scale;
  const enter = interpolate(frame, [4, 46], [0, 1], { ...clamp, easing: easeOut });
  const leave = interpolate(frame, [ENTER, ENTER + 14], [0, 1], { ...clamp, easing: easeInOut });
  return (
    <div
      style={{
        position: "absolute",
        left: cx - size * 2.5,
        width: size * 5,
        top: headTop - size * 0.8,
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

export function Hero({ f }: { f: Format }) {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: BACKDROP, overflow: "hidden" }}>
      <Word f={f} frame={frame} />
      {TIGERS.map((box, i) => {
        const e = ENTRIES[i];
        const p = interpolate(frame, [e.start, e.start + WALK], [0, 1], {
          ...clamp,
          easing: Easing.bezier(0.33, 0.2, 0.3, 1),
        });
        const x = e.from.x * f.width * (1 - p);
        const scale = e.from.scale + (1 - e.from.scale) * p;
        const lift = e.from.lift * box.height * f.scale * (1 - p);
        const walk = gait(p);
        const step = walk.bob * 6 * f.scale;
        const sway = walk.roll * 1.6;
        const appear = interpolate(frame, [e.start, e.start + 14], [0, 1], clamp);
        // Depth of field: far away is softer.
        const blur = (1 - p) * 4;
        // Paw lift: the leg strip shortens from the knee, so there is no seam.
        const legLift = (side: number) => 1 - side * 0.09;

        // Act 2: gold light sweep reveals the model, tiger dissolves behind it.
        const t0 = ENTER + i * 12;
        const s = interpolate(frame, [t0, t0 + TRANSFORM - 32], [0, 1], { ...clamp, easing: easeInOut });
        const model = MODELS[i];
        const mx = f.x + model.left * f.scale;
        const mw = model.width * f.scale;
        const top = Math.min(box.top, model.top);
        const beamX = mx - mw * 0.4 + s * mw * 1.8;
        // The reveal edge follows the beam core, so nothing changes ahead of the light.
        const cut = (left: number, width: number) =>
          Math.min(Math.max((beamX - left) / width, 0), 1);
        const modelCut = cut(mx, mw);
        const tigerCut = cut(f.x + box.left * f.scale, box.width * f.scale);
        const beam = Math.sin(s * Math.PI);

        const origin = `${(box.left + box.width / 2) * f.scale + f.x}px ${(box.top + box.height) * f.scale + f.y}px`;
        return (
          <AbsoluteFill key={i}>
            <AbsoluteFill style={{ transform: `translate(${x}px, ${lift - step}px) scale(${scale}) rotate(${sway}deg)`, transformOrigin: origin }}>
              <Shadow box={box} f={f} opacity={appear * (1 - tigerCut)} scale={1 - step / 60} />
              <AbsoluteFill
                style={{
                  opacity: appear * (1 - tigerCut * 0.9),
                  filter: `blur(${blur + tigerCut * 3}px) brightness(${1 + beam * 0.25})`,
                  clipPath: `inset(0 0 0 ${f.x + box.left * f.scale + tigerCut * box.width * f.scale}px)`,
                }}
              >
                {/* Body and head above the knees. */}
                <Figure
                  src={`tiger-${i}.png`}
                  box={box}
                  f={f}
                  style={{ clipPath: `inset(0 0 ${(1 - KNEE) * 100 - 0.5}% 0)` }}
                />
                {/* Left and right legs, lifting in turn. */}
                {[0, 1].map((side) => (
                  <Figure
                    key={side}
                    src={`tiger-${i}.png`}
                    box={box}
                    f={f}
                    style={{
                      clipPath: side === 0 ? `inset(${KNEE * 100}% 50% 0 0)` : `inset(${KNEE * 100}% 0 0 50%)`,
                      transform: `scaleY(${side === 0 ? legLift(walk.left) : legLift(walk.right)})`,
                      transformOrigin: `50% ${KNEE * 100}%`,
                    }}
                  />
                ))}
              </AbsoluteFill>
            </AbsoluteFill>
            <Figure
              src={`model-${i}.png`}
              box={model}
              f={f}
              style={{
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
                top: f.y + top * f.scale - 40 * f.scale,
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
                top: f.y + top * f.scale - 40 * f.scale,
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
