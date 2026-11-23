#!/usr/bin/env sh
# Renders the hero scene and exports it for the site (frontend/public/hero):
#   enter-<format>.mp4      act 1, the animals walk in (AI clip cut out per frame) (autoplay, holds its last frame)
#   enter-<format>.webm     the same act 1 in VP9, for browsers without H.264
#   tf-<format>/NN.jpg      act 2, light sweep turns them into models (scroll-scrubbed)
# Both come from one h264 render, so the backdrop colour is identical in both.
# Usage (from video/): sh scripts/export.sh
set -e
ENTER=137 # frames in act 1: src/layout.ts ENTER (WALK_END + 6); update both together
OUT=../frontend/public/hero
# Remotion ships ffmpeg; call it directly (npx on Windows splits arguments at commas).
FFMPEG=$(ls node_modules/@remotion/compositor-*/ffmpeg* | head -1)
mkdir -p out "$OUT"
for f in desktop mobile; do
  id=$( [ "$f" = desktop ] && echo HeroDesktop || echo HeroMobile )
  npx remotion render src/index.ts "$id" "out/full-$f.mp4" --codec=h264 --crf=14 --color-space=bt709 --log=error
  "$FFMPEG" -v error -y -i "out/full-$f.mp4" -vf "trim=end_frame=$ENTER" \
    -an -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -movflags +faststart "$OUT/enter-$f.mp4"
  # The same film in VP9 for browsers without H.264 (#322). Remotion's ffmpeg has no
  # VP9 encoder, so this needs a full ffmpeg on PATH.
  ffmpeg -v error -y -i "$OUT/enter-$f.mp4" -an -c:v libvpx-vp9 -crf 42 -b:v 0 -row-mt 1 \
    -deadline good -cpu-used 2 -pix_fmt yuv420p "$OUT/enter-$f.webm"
  rm -rf "$OUT/tf-$f" && mkdir -p "$OUT/tf-$f"
  # Remotion's ffmpeg is a minimal build (no setpts/framestep/libwebp): half rate via -r.
  "$FFMPEG" -v error -y -i "out/full-$f.mp4" -vf "trim=start_frame=$ENTER" -r 15 \
    -c:v mjpeg -q:v 5 -start_number 0 "$OUT/tf-$f/%02d.jpg"
done
ls -la "$OUT" "$OUT/tf-desktop" | head -8
