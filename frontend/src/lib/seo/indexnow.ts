/**
 * IndexNow key file (#62): the backend tells Bing, Yandex and the other IndexNow engines
 * which product and store pages changed, and the engines check that the key it sends is
 * served by the site at `/<key>.txt`. The key comes only from the environment
 * (`JEPARLA_INDEXNOW_KEY`, the same variable the API reads), never from the repository,
 * and is read when the request comes, so a new key needs no rebuild. No key: 404.
 */

/** IndexNow key format: 8 to 128 letters, digits or dashes (indexnow.org). */
const KEY = /^[A-Za-z0-9-]{8,128}$/;

/** The configured key, or null when it is unset or not a valid key. */
export function indexNowKey(env: Record<string, string | undefined> = process.env): string | null {
  const key = env.JEPARLA_INDEXNOW_KEY?.trim() ?? "";
  return KEY.test(key) ? key : null;
}

/** The answer to `/<requested>.txt`: the key as plain text when it is the configured one. */
export function indexNowKeyResponse(
  requested: string,
  env: Record<string, string | undefined> = process.env,
): Response {
  const key = indexNowKey(env);
  if (!key || requested !== key) {
    return new Response("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return new Response(key, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
