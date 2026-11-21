import { AbsoluteFill } from "remotion";
import { Caption } from "./Caption";
import { Backdrop, Body, CREAM, GOLD, EndCard, Gold, Heading, Kicker, Phone, Rise, Rule, Safe, SANS, Scene, Step, type ShortProps } from "./kit";

/** Short 2, "The gram price of gold follows the CBAR rate" (22 s). */
export const SHORT2 = { duration: 660 };

/**
 * Real quotes from the live API (GET https://api.jeparla.duckdns.org/api/v1/metal-prices/history?metal=GOLD,
 * source CBAR), read 2026-11-18. Update all of them together before a re-render; every number on
 * screen is derived from these and dated.
 */
export const PRICES = {
  today: { date: "18.11.2026", ounce: "6 435,2055", gram: "206,8967", g585: "121,03" },
  yesterday: { date: "17.11.2026", g585: "123,87" },
};

const T = { yesterday: 66, how: 132, s1: 170, s2: 222, s3: 274, phone: 392, linked: 476, end: 552 };

function Big({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 200, lineHeight: 1, color: GOLD, letterSpacing: -4 }}>{children}</div>;
}

export function Short2MetalPrice({ platform }: ShortProps) {
  const { today, yesterday } = PRICES;
  return (
    <AbsoluteFill>
      <Backdrop />
      <Scene from={0} to={T.how + 6}>
        <Backdrop dark />
        <Safe top={520}>
          <Rise at={0} dy={20}>
            <Kicker color={CREAM}>585 əyar qızıl, 1 qram</Kicker>
          </Rise>
          <Rise at={6} style={{ marginTop: 30 }}>
            <Big>{today.g585} ₼</Big>
          </Rise>
          <Rise at={14} style={{ marginTop: 26 }}>
            <Body size={44} color={CREAM}>
              AMB məzənnəsi, {today.date}
            </Body>
          </Rise>
          <Rise at={T.yesterday} style={{ marginTop: 90 }}>
            <Rule />
            <Body size={52} color={CREAM} style={{ marginTop: 34 }}>
              Bir gün əvvəl, {yesterday.date}: <Gold dark>{yesterday.g585} ₼</Gold>
            </Body>
            <Body size={36} color="rgba(247,243,234,0.8)" style={{ fontWeight: 500, marginTop: 28 }}>
              Yalnız metalın dəyəri: işçilik, daşlar və mağazanın əlavəsi daxil deyil.
            </Body>
          </Rise>
        </Safe>
      </Scene>
      <Scene from={T.how} to={T.phone + 6}>
        <Backdrop />
        <Safe top={290}>
          <Rise at={T.how + 4}>
            <Heading size={104}>Bu rəqəm haradan gəlir?</Heading>
          </Rise>
          <div style={{ display: "flex", flexDirection: "column", gap: 54, marginTop: 70 }}>
            <Step at={T.s1} n="1" title="AMB hər iş günü dərc edir" text={`1 troy unsiya təmiz qızıl: ${today.ounce} ₼`} />
            <Step at={T.s2} n="2" title="Qrama çevrilir" text={`${today.ounce} ÷ 31,1034768 = ${today.gram} ₼`} />
            <Step at={T.s3} n="3" title="Əyara vurulur" text={`${today.gram} × 0,585 = ${today.g585} ₼`} />
          </div>
        </Safe>
      </Scene>
      <Scene from={T.phone} to={T.end + 10}>
        <Backdrop />
        <Phone from={T.phone} to={T.end + 10} screens={[{ name: "home-prices", at: T.phone, focus: [0.5, 0.3], zoomTo: 1.2 }]} />
        <Caption from={T.phone + 4} to={T.linked + 4}>
          Jeparla bu hesabı <Gold>hər səhər</Gold> özü edir.
        </Caption>
        <Caption from={T.linked + 4} to={T.end + 10} size={62}>
          “Metala bağlı” məhsulun qiyməti də <Gold>özü yenilənir</Gold>.
        </Caption>
      </Scene>
      <EndCard at={T.end} platform={platform} line="Qızıl və gümüşün bugünkü qram qiyməti." />
    </AbsoluteFill>
  );
}
