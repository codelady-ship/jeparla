import { SITE_URL } from "@/i18n/alternates";
import { api, USING_MOCK } from "@/lib/api";
import { buildLlmsFullTxt } from "@/lib/seo/llms";

// The long version of /llms.txt (llmstxt.org): site text, price method and category tree.
export async function GET() {
  const [categories, stores] = await Promise.all([api.listCategories(), api.listStores()]);
  // Sample stores are invented: they are never handed to AI assistants as real shops.
  const body = buildLlmsFullTxt(SITE_URL, { categories, stores: USING_MOCK ? [] : stores });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
