import { AbsoluteFill, Img, interpolate, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import { Caption } from "./Caption";
import { AiTag, Backdrop, Body, clamp, easeOut, EndCard, Gold, Heading, Phone, Rise, Safe, Scene, SHORT, type ShortProps } from "./kit";

/** Short 1, "What Jeparla is" (18 s). The animals and models are the AI hero visuals (docs/credits.md). */
export const SHORT1 = { duration: 540 };

const T = { models: 96, phone: 196, prices: 290, checks: 362, end: 430 };

function Models() {
  const frame = useCurrentFrame();
  const h = 1150;
  const w = (h * 832) / 1248;
  const offsets = [-0.33, 0.33, 0];
  return (
    <>
      {offsets.map((o, i) => {
        const p = interpolate(frame, [T.models + 4 + i * 6, T.models + 30 + i * 6], [0, 1], { ...clamp, easing: easeOut });
        return (
          <Img
            key={i}
            src={staticFile(`model-${[0, 2, 1][i]}.png`)}
            style={{
              position: "absolute",
              width: w,
              height: h,
              left: 470 + o * h - w / 2,
              top: SHORT.height - h + (1 - p) * 220,
              opacity: p,
            }}
          />
        );
      })}
    </>
  );
}

export function Short1Jeparla({ platform }: ShortProps) {
  return (
    <AbsoluteFill>
      <Backdrop />
      <Scene from={0} to={T.models + 6}>
        {/* The hero clip is framed for a full phone screen: zoom on the animals and lift them above the bottom UI zone. */}
        <OffthreadVideo
          src={staticFile("social/shorts/walk.mp4")}
          muted
          style={{ width: "100%", height: "100%", transformOrigin: "540px 1766px", transform: "translateY(-300px) scale(1.4)" }}
        />
        <Safe top={300}>
          <Rise at={4}>
            <Heading size={112}>Qızıl, gümüş, brilyant.</Heading>
          </Rise>
          <Rise at={22}>
            <Heading size={112}>
              <Gold>Bir saytda.</Gold>
            </Heading>
          </Rise>
        </Safe>
        <AiTag />
      </Scene>
      <Scene from={T.models} to={T.phone + 6}>
        <Backdrop />
        <Models />
        <Safe top={300}>
          <Rise at={T.models + 6}>
            <Heading size={104}>Parıltının hər çaları</Heading>
          </Rise>
          <Rise at={T.models + 20}>
            <Heading size={104}>
              <Gold>bir yerdə.</Gold>
            </Heading>
          </Rise>
        </Safe>
        <AiTag />
      </Scene>
      <Scene from={T.phone} to={T.end + 10}>
        <Backdrop />
        <Phone
          from={T.phone}
          to={T.end + 10}
          ai={[T.phone, T.prices + 8]}
          screens={[
            { name: "home-top", at: T.phone },
            { name: "home-prices", at: T.prices, focus: [0.3, 0.22], zoomTo: 1.4 },
            { name: "home-checks", at: T.checks, focus: [0.2, 0.25], zoomTo: 1.3 },
          ]}
        />
        <Caption from={T.phone + 4} to={T.prices + 4}>
          Zərgərlik mağazaları <Gold>bir kataloqda</Gold>.
        </Caption>
        <Caption from={T.prices + 4} to={T.checks + 4}>
          Qızılın qram qiyməti hər gün <Gold>AMB-dən</Gold>.
        </Caption>
        <Caption from={T.checks + 4} to={T.end + 10}>
          Mağaza yoxlanılır, sən birbaşa <Gold>WhatsApp</Gold>-a yazırsan.
        </Caption>
      </Scene>
      <EndCard
        at={T.end}
        platform={platform}
        line="Azərbaycanın zərgərlik mağazaları bir yerdə."
        extra={<Body size={40} style={{ fontWeight: 500 }}>Mağazalar üçün qeydiyyat açıqdır.</Body>}
      />
    </AbsoluteFill>
  );
}
