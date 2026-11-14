import { Composition } from "remotion";
import { Hero } from "./Hero";
import { DESKTOP, ENTER, FPS, MOBILE, TRANSFORM } from "./layout";
import { Reel, REEL, type ReelProps } from "./social/Reel";

const DURATION = ENTER + TRANSFORM;

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
    </>
  );
}
