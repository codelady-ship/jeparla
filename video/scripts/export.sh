#!/usr/bin/env sh
# Renders the hero scene and exports it for the site (frontend/public/hero):
#   enter-<format>.mp4      act 1, tigers walk in (autoplay, holds its last frame)
#   tf-<format>/NN.jpg      act 2, light sweep turns them into models (scroll-scrubbed)
# Both come from one h264 render, so the backdrop colour is identical in both.
# Usage (from video/): sh scripts/export.sh
set -e
ENTER=96 # frames in act 1 (src/layout.ts ENTER)
OUT=../frontend/public/hero
# Remotion ships ffmpeg; call it directly (npx on Windows splits arguments at commas).
FFMPEG=$(ls node_modules/@remotion/compositor-*/ffmpeg* | head -1)
mkdir -p out "$OUT"
for f in desktop mobile; do
  id=$( [ "$f" = desktop ] && echo HeroDesktop || echo HeroMobile )
  npx remotion render src/index.ts "$id" "out/full-$f.mp4" --codec=h264 --crf=14 --log=error
  "$FFMPEG" -v error -y -i "out/full-$f.mp4" -vf "trim=end_frame=$ENTER" \
    -an -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p -movflags +faststart "$OUT/enter-$f.mp4"
  rm -rf "$OUT/tf-$f" && mkdir -p "$OUT/tf-$f"
  "$FFMPEG" -v error -y -i "out/full-$f.mp4" -vf "trim=start_frame=$ENTER" \
    -c:v mjpeg -q:v 4 -start_number 0 "$OUT/tf-$f/%02d.jpg"
done
ls -la "$OUT" "$OUT/tf-desktop" | head -8
