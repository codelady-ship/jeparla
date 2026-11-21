import { AbsoluteFill } from "remotion";
import { Caption } from "./Caption";
import { Backdrop, Body, ClipCard, EndCard, Gold, Heading, Kicker, Phone, Rise, Safe, SAFE, Scene, Step, StockNote, type ShortProps } from "./kit";

/** Short 5, "What the Jeparla Verified badge means" (20 s). Wording follows /verified (Verified copy). */
export const SHORT5 = { duration: 600 };

const T = { checks: 104, c: [136, 176, 216], rule: 262, phone: 388, tip: 440, end: 492 };

export function Short5Verified({ platform }: ShortProps) {
  return (
    <AbsoluteFill>
      <Backdrop />
      <Scene from={0} to={T.checks + 6}>
        <Backdrop />
        <Safe top={290}>
          <Rise at={2}>
            <Heading size={112}>
              <Gold>Jeparla Verified</Gold> nə deməkdir?
            </Heading>
          </Rise>
        </Safe>
        <ClipCard src="vitrine.mp4" x={SAFE.left + 30} y={640} w={820} h={800} from={0} to={T.checks + 6} />
        <StockNote top={1456} left={SAFE.left + 30} />
      </Scene>
      <Scene from={T.checks} to={T.phone + 6}>
        <Backdrop />
        <Safe top={290}>
          <Rise at={T.checks + 4} dy={20}>
            <Kicker>Jeparla Verified</Kicker>
          </Rise>
          <Rise at={T.checks + 10}>
            <Heading size={104} style={{ marginTop: 18 }}>
              Bir nişan, <Gold>üç ayrı</Gold> yoxlama.
            </Heading>
          </Rise>
          <div style={{ display: "flex", flexDirection: "column", gap: 60, marginTop: 70 }}>
            <Step at={T.c[0]} n="1" title="Satıcı" text="Mağazanın real olması: ad, ünvan, telefon, VÖEN." />
            <Step at={T.c[1]} n="2" title="Sənədlər" text="Komanda əl ilə yoxlayır; sənədlər ictimai göstərilmir." />
            <Step at={T.c[2]} n="3" title="Fiziki ekspertiza" text="Müstəqil mütəxəssis baxır; yalnız “Yoxlanılıb” yazılan məhsulda." />
          </div>
          <Rise at={T.rule} style={{ marginTop: 70 }}>
            <Body size={44}>
              Nişan satıcı və sənəd yoxlaması <Gold>ikisi də keçəndə</Gold> görünür.
            </Body>
          </Rise>
        </Safe>
      </Scene>
      <Scene from={T.phone} to={T.end + 10}>
        <Backdrop />
        <Phone from={T.phone} to={T.end + 10} screens={[{ name: "verified-checks", at: T.phone, focus: [0.5, 0.3], zoomTo: 1.08 }]} />
        <Caption from={T.phone + 4} to={T.tip + 4}>
          Heç bir yoxlama <Gold>tam zəmanət</Gold> deyil.
        </Caption>
        <Caption from={T.tip + 4} to={T.end + 10} size={62}>
          Damğanı, çəkini və çeki <Gold>mağazada</Gold> yoxla.
        </Caption>
      </Scene>
      <EndCard at={T.end} platform={platform} line="Kimin və nəyin yoxlandığını açıq göstəririk." />
    </AbsoluteFill>
  );
}
