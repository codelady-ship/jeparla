import { AbsoluteFill } from "remotion";
import { Caption } from "./Caption";
import { Backdrop, Body, ClipCard, EndCard, Gold, Heading, Phone, Rise, Safe, SAFE, Scene, StockNote, type ShortProps } from "./kit";

/** Short 4, for sellers: "List your store for free" (22 s). Claims as on /sell (SellLanding copy). */
export const SHORT4 = { duration: 660 };

const T = { phone: 108, steps: 262, linked: 430, wa: 494, end: 556 };

export function Short4Sellers({ platform }: ShortProps) {
  return (
    <AbsoluteFill>
      <Backdrop />
      <Scene from={0} to={T.phone + 6}>
        <Backdrop />
        <Safe top={290}>
          <Rise at={2}>
            <Heading size={124}>
              Zərgərlik <Gold>mağazan</Gold> var?
            </Heading>
          </Rise>
        </Safe>
        <ClipCard src="atelier.mp4" x={SAFE.left + 30} y={640} w={820} h={800} from={0} to={T.phone + 6} startFrom={30} />
        <StockNote top={1456} left={SAFE.left + 30} />
      </Scene>
      <Scene from={T.phone} to={T.end + 10}>
        <Backdrop />
        <Phone
          from={T.phone}
          to={T.end + 10}
          screens={[
            { name: "sell-top", at: T.phone, focus: [0.2, 0.3], zoomTo: 1.4 },
            { name: "sell-steps", at: T.steps, focus: [0.2, 0.3], zoomTo: 1.35 },
            { name: "sell-compare", at: T.linked, focus: [0.5, 0.45], zoomTo: 1.3 },
          ]}
        />
        <Caption from={T.phone + 4} to={T.steps + 4}>
          Jeparla kataloqunda yer almaq <Gold>pulsuzdur</Gold>.
        </Caption>
        <Caption from={T.steps + 4} to={T.linked + 4} size={62}>
          Hesab və mağaza, sənədlər, məhsullar: <Gold>üç addım</Gold>.
        </Caption>
        <Caption from={T.linked + 4} to={T.wa + 4} size={62}>
          “Metala bağlı” qiymət AMB məzənnəsi ilə <Gold>özü yenilənir</Gold>.
        </Caption>
        <Caption from={T.wa + 4} to={T.end + 10}>
          Alıcı sənə birbaşa <Gold>WhatsApp</Gold>-da yazır.
        </Caption>
      </Scene>
      <EndCard
        at={T.end}
        platform={platform}
        line="Mağazanı Jeparla-da aç."
        extra={<Body size={40} style={{ fontWeight: 500 }}>Öz linkini Instagram bio-na qoy.</Body>}
      />
    </AbsoluteFill>
  );
}
