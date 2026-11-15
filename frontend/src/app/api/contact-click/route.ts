import { connection } from "next/server";
import { apiFetch } from "@/lib/api/http";
import { visitorHeaders } from "@/lib/api/live";
import { USING_MOCK } from "@/lib/api/mode";
import { parseContactClick } from "@/lib/contact-click";

/**
 * WhatsApp click statistics (#111): the product page sends `{ productId, question }` with
 * `navigator.sendBeacon` when the buyer opens WhatsApp. Forwarded to
 * `POST /api/v1/products/{id}/contact-click?question=` with the visitor headers, so the
 * backend per-IP limit counts each visitor. Nothing about the buyer is sent or stored:
 * no message text, no phone, no account. Always 204: statistics never block the buyer.
 */
export async function POST(request: Request) {
  await connection();
  const click = parseContactClick(await request.text().catch(() => ""));
  if (click && !USING_MOCK) {
    try {
      await apiFetch(`/products/${click.productId}/contact-click`, {
        method: "POST",
        query: { question: click.question },
        headers: await visitorHeaders(),
        timeoutMs: 3_000,
      });
    } catch {
      // A lost click is only a missing count.
    }
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
