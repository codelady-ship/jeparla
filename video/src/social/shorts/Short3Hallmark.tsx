import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Backdrop, Body, clamp, ClipCard, CREAM, easeInOut, EndCard, GOLD, GOLD_TEXT, Gold, Heading, INK, Rise, Safe, SAFE, SANS, Scene, Step, StockNote, useIn, type ShortProps } from "./kit";

/** Short 3, "What 585 means" (20 s). Fineness facts as on the site (calculator FAQ, prices page). */
export const SHORT3 = { duration: 600 };

const T = { scale: 106, bars: [150, 190, 230], check: 340, c: [366, 398, 430], end: 500 };

const BARS = [
  { n: "585", label: "qızıl, 14K", share: 0.585, text: "58,5% təmiz qızıl" },
  { n: "750", label: "qızıl, 18K", share: 0.75, text: "75% təmiz qızıl" },
  { n: "925", label: "gümüş", share: 0.925, text: "92,5% təmiz gümüş" },
];

function Bar({ n, label, share, text, at }: (typeof BARS)[number] & { at: number }) {
  const frame = useCurrentFrame();
  const p = useIn(at, 14);
  const fill = interpolate(frame, [at + 6, at + 34], [0, share], { ...clamp, easing: easeInOut });
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 22 }}>
        <Heading size={140} style={{ lineHeight: 1 }}>
          {n}
        </Heading>
        <Body size={38} style={{ fontWeight: 500 }}>
          {label}
        </Body>
      </div>
      <div style={{ marginTop: 14, height: 34, borderRadius: 17, background: "rgba(22,37,31,0.12)", overflow: "hidden" }}>
        <div style={{ width: `${fill * 100}%`, height: "100%", background: GOLD, borderRadius: 17 }} />
      </div>
      <div style={{ marginTop: 10, fontFamily: SANS, fontWeight: 700, fontSize: 36, color: GOLD_TEXT }}>{text}</div>
    </div>
  );
}

export function Short3Hallmark({ platform }: ShortProps) {
  return (
    <AbsoluteFill>
      <Backdrop />
      <Scene from={0} to={T.scale + 6}>
        <Backdrop />
        <Safe top={290}>
          <Rise at={2}>
            <Heading size={128}>
              <Gold>585</Gold> nə deməkdir?
            </Heading>
          </Rise>
        </Safe>
        <ClipCard src="ring.mp4" x={SAFE.left + 50} y={500} w={780} h={940} from={0} to={T.scale + 6} />
        <StockNote top={1456} left={SAFE.left + 50} />
      </Scene>
      <Scene from={T.scale} to={T.check + 6}>
        <Backdrop />
        <Safe top={280}>
          <Rise at={T.scale + 4}>
            <Heading size={84}>Əyar: 1000 hissədə neçə hissə təmiz metaldır.</Heading>
          </Rise>
          <div style={{ display: "flex", flexDirection: "column", gap: 70, marginTop: 80 }}>
            {BARS.map((b, i) => (
              <Bar key={b.n} {...b} at={T.bars[i]} />
            ))}
          </div>
        </Safe>
      </Scene>
      <Scene from={T.check} to={T.end + 10}>
        <Backdrop dark />
        <Safe top={300}>
          <Rise at={T.check + 4}>
            <Heading size={96} color={CREAM}>
              Almadan əvvəl mağazada yoxla:
            </Heading>
          </Rise>
          <div style={{ display: "flex", flexDirection: "column", gap: 80, marginTop: 110 }}>
            <Step dark at={T.c[0]} n="1" title="Damğa" text="Məhsulun üzərindəki əyar damğası" />
            <Step dark at={T.c[1]} n="2" title="Çəki" text="Tərəzidə, qramla" />
            <Step dark at={T.c[2]} n="3" title="Çek" text="Əyar və çəki çekdə yazılsın" />
          </div>
        </Safe>
      </Scene>
      <EndCard
        at={T.end}
        platform={platform}
        line="Zərgərliyi əyara, metala və qiymətə görə axtar."
        extra={<Body size={38} style={{ fontWeight: 500, color: INK }}>Qızıl kalkulyatoru da saytda.</Body>}
      />
    </AbsoluteFill>
  );
}
