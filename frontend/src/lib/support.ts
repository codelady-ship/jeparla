/**
 * Public support contact shown on the help page (#167), from NEXT_PUBLIC_SUPPORT_EMAIL and
 * NEXT_PUBLIC_SUPPORT_URL (the frontend twins of the API's JEPARLA_SUPPORT_EMAIL / _URL).
 * A value that is not a plain email address or an absolute http(s) URL is ignored, so the
 * page never shows a broken or unsafe link. Nothing is invented when both are unset.
 */
export type SupportContact = { email: string | null; url: string | null };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function supportContact(
  email: string | undefined = process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
  url: string | undefined = process.env.NEXT_PUBLIC_SUPPORT_URL,
): SupportContact {
  const e = email?.trim() ?? "";
  const u = url?.trim() ?? "";
  return { email: EMAIL.test(e) ? e : null, url: isHttpUrl(u) ? u : null };
}

function isHttpUrl(value: string): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.hostname !== "";
  } catch {
    return false;
  }
}
