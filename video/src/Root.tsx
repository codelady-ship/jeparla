import { Composition } from "remotion";
import { Hero } from "./Hero";
import { DESKTOP, ENTER, FPS, MOBILE, TRANSFORM } from "./layout";
import { Reel, REEL, type ReelProps } from "./social/Reel";
import { SHORT, type ShortProps } from "./social/shorts/kit";
import { Short1Jeparla, SHORT1 } from "./social/shorts/Short1Jeparla";
import { Short2MetalPrice, SHORT2 } from "./social/shorts/Short2MetalPrice";
import { Short3Hallmark, SHORT3 } from "./social/shorts/Short3Hallmark";
import { Short4Sellers, SHORT4 } from "./social/shorts/Short4Sellers";
import { Short5Verified, SHORT5 } from "./social/shorts/Short5Verified";

const DURATION = ENTER + TRANSFORM;

/** Social shorts: one composition each; render with --props='{"platform":"yt"}' for the other CTAs. */
const SHORTS = [
  { id: "Short1Jeparla", component: Short1Jeparla, duration: SHORT1.duration },
  { id: "Short2MetalPrice", component: Short2MetalPrice, duration: SHORT2.duration },
  { id: "Short3Hallmark", component: Short3Hallmark, duration: SHORT3.duration },
  { id: "Short4Sellers", component: Short4Sellers, duration: SHORT4.duration },
  { id: "Short5Verified", component: Short5Verified, duration: SHORT5.duration },
];

export function Root() {
  return (
    <>
      <Composition
        id="HeroDesktop"
        component={Hero}
        defaultProps={{ f: DESKTOP }}
        durationInFrames={DURATION}
        fps={FPS}
        width={DESKTOP.width}
        height={DESKTOP.height}
      />
      <Composition
        id="HeroMobile"
        component={Hero}
        defaultProps={{ f: MOBILE }}
        durationInFrames={DURATION}
        fps={FPS}
        width={MOBILE.width}
        height={MOBILE.height}
      />
      <Composition
        id="Reel1"
        component={Reel}
        defaultProps={{} as ReelProps}
        durationInFrames={REEL.duration}
        fps={REEL.fps}
        width={REEL.width}
        height={REEL.height}
      />
      {SHORTS.map((s) => (
        <Composition
          key={s.id}
          id={s.id}
          component={s.component}
          defaultProps={{ platform: "ig" } as ShortProps}
          durationInFrames={s.duration}
          fps={SHORT.fps}
          width={SHORT.width}
          height={SHORT.height}
        />
      ))}
    </>
  );
}
