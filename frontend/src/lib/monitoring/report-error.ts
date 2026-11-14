/**
 * Browser error reporting to Sentry (#56) without the Sentry SDK: the SDK costs tens of KB of script,
 * over the 250 KB budget. One envelope per error caught by an error boundary, sent with fetch keepalive.
 *
 * Off unless NEXT_PUBLIC_SENTRY_DSN is set. Privacy: no user id, no IP (Sentry stores none unless the
 * project's "Prevent storing of IP addresses" is off; turn it on), no cookies, and the page URL without its
 * query string (search words stay out). Only the error type, message, stack and Next's digest are sent.
 */

export type SentryDsn = { endpoint: string; publicKey: string; dsn: string };

/** "https://<key>@o1.ingest.sentry.io/<project>" -> the envelope endpoint, or null if it is not a DSN. */
export function parseDsn(dsn: string | undefined): SentryDsn | null {
  if (!dsn) return null;
  try {
    const u = new URL(dsn);
    const project = u.pathname.replace(/^\/+|\/+$/g, "");
    if (u.protocol !== "https:" || !u.username || !/^\d+$/.test(project)) return null;
    return {
      endpoint: `${u.protocol}//${u.host}/api/${project}/envelope/`,
      publicKey: u.username,
      dsn,
    };
  } catch {
    return null;
  }
}

function eventId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The envelope body: header, item header, event (newline separated JSON). */
export function buildEnvelope(
  error: unknown,
  {
    dsn,
    url,
    environment,
    release,
    now = new Date(),
  }: {
    dsn: SentryDsn;
    url: string;
    environment?: string;
    release?: string;
    now?: Date;
  },
): string {
  const id = eventId();
  const e = error instanceof Error ? error : new Error(String(error));
  const digest = (error as { digest?: unknown } | null)?.digest;
  const page = url.split(/[?#]/)[0];
  const event = {
    event_id: id,
    timestamp: now.getTime() / 1000,
    platform: "javascript",
    level: "error",
    environment: environment || "production",
    ...(release ? { release } : {}),
    request: { url: page },
    tags: typeof digest === "string" ? { digest } : undefined,
    exception: {
      values: [{ type: e.name, value: e.message.slice(0, 500), stacktrace: undefined }],
    },
    extra: e.stack ? { stack: e.stack.slice(0, 4000) } : undefined,
  };
  return [
    JSON.stringify({ event_id: id, sent_at: now.toISOString(), dsn: dsn.dsn }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");
}

/** Sends the error if a DSN is configured; never throws. */
export function reportError(error: unknown): void {
  const dsn = parseDsn(process.env.NEXT_PUBLIC_SENTRY_DSN);
  if (!dsn || typeof window === "undefined") return;
  try {
    const body = buildEnvelope(error, {
      dsn,
      url: window.location.href,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
      release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    });
    void fetch(`${dsn.endpoint}?sentry_key=${encodeURIComponent(dsn.publicKey)}&sentry_version=7`, {
      method: "POST",
      body,
      keepalive: true,
      credentials: "omit",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
    }).catch(() => {});
  } catch {
    // reporting must never break the error page
  }
}
