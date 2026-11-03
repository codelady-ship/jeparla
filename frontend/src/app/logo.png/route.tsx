import { ImageResponse } from "next/og";

// Raster logo for schema.org Organization (search engines want PNG/JPG, >= 112px).
// Colors mirror the brand tokens; ImageResponse cannot read CSS variables.
const BRAND_DARK = "#16251F";
const BRAND_GOLD = "#C5A15A";

export function GET() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND_DARK,
        color: BRAND_GOLD,
        fontSize: 340,
        fontWeight: 700,
      }}
    >
      J
    </div>,
    { width: 512, height: 512 },
  );
}
