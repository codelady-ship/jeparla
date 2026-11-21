import { ImageResponse } from "next/og";
import { markDataUrl } from "@/components/brand/logo-svg";

// Raster logo for schema.org Organization and default link previews (search engines want
// PNG/JPG, >= 112px): the compact mark of logo option A (#50).
export function GET() {
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element -- ImageResponse draws plain img only
    <img src={markDataUrl()} alt="" width={512} height={512} />,
    { width: 512, height: 512 },
  );
}
