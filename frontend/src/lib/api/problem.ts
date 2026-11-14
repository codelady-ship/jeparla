import { ApiError } from "./http";

/**
 * Turns a failed backend call into the `{ errors }` answer the cabinet forms read. Values are
 * either i18n keys of the form (no spaces: "unavailable", "sessionExpired", "server") or the
 * backend's own message, already in the visitor's language (Accept-Language) and shown as is.
 * Field paths follow the form keys: `variants[0].price` becomes `variants.0.price`.
 */
export function problemResponse(e: unknown): Response {
  if (!(e instanceof ApiError)) {
    console.error(e);
    return Response.json({ errors: { form: "server" } }, { status: 500 });
  }
  if (e.status === 0) return Response.json({ errors: { form: "unavailable" } }, { status: 503 });
  if (e.status === 401)
    return Response.json({ errors: { form: "sessionExpired" } }, { status: 401 });
  const errors: Record<string, string> = {};
  for (const { field, message } of e.fieldErrors) {
    errors[field.replace(/\[(\d+)\]/g, ".$1")] ??= message;
  }
  errors.form = e.detail ?? (e.status === 429 ? "rateLimited" : "server");
  return Response.json({ errors, code: e.code }, { status: e.status >= 400 ? e.status : 500 });
}

/** An error value that is the backend's own sentence rather than an i18n key. */
export const isMessage = (value: string) => /\s/.test(value);
