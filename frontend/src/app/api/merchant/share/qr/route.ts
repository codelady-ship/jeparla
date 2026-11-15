import { USING_MOCK } from "@/lib/api";
import { ApiError } from "@/lib/api/http";
import { userFetch } from "@/lib/auth/backend";
import { merchantOr401 } from "@/lib/merchant/server";

/**
 * QR code of the own store's share link (#100) as SVG, drawn by the backend
 * (GET /merchant/store/share/qr.svg), so the browser loads no QR library. Same origin as
 * the page: an <img> sends the session cookie and the access token never reaches the browser.
 */
export async function GET() {
  const session = await merchantOr401();
  if (session instanceof Response) return session;
  if (USING_MOCK) return new Response(null, { status: 503 });
  try {
    const svg = await userFetch<string>("/merchant/store/share/qr.svg", {
      asText: true,
      canRefresh: true,
    });
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      },
    });
  } catch (e) {
    return new Response(null, { status: e instanceof ApiError && e.status ? e.status : 502 });
  }
}
