import colors from "@/lib/brand-colors.json";

/** Brand tokens for ImageResponse, which cannot read CSS variables. */
export const BRAND_OG = {
  green: colors.light.primary,
  gold: colors.light.accent,
  cream: colors.light.bg,
  text: colors.light.text,
};

/** Formats ImageResponse can draw (it cannot decode WebP or AVIF). */
const DRAWABLE = new Set(["image/jpeg", "image/png"]);
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Loads a product photo for a link preview as a data URL, or null when it cannot be drawn
 * (other format, too large, slow or missing): the preview is then drawn without a photo.
 */
export async function imageAsDataUrl(
  url: string,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const res = await fetcher(url, { signal: AbortSignal.timeout(3_000) });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!DRAWABLE.has(type)) return null;
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return null;
    return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}
