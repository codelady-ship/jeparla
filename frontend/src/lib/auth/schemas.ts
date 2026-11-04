import { z } from "zod";

/**
 * Form rules shared by the browser (instant feedback) and the route handlers
 * (never trust the client). Messages are i18n keys under Auth.errors.
 */
export const PASSWORD_MIN = 8;

const email = z
  .string()
  .trim()
  .min(1, "required")
  .max(254, "emailInvalid")
  .pipe(z.email("emailInvalid"));
const password = z.string().min(1, "required");

export const loginSchema = z.object({ email, password });

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "nameShort").max(80, "nameLong"),
    email,
    password: z
      .string()
      .min(PASSWORD_MIN, "passwordShort")
      .max(128, "passwordLong")
      .regex(/\p{L}/u, "passwordLetter")
      .regex(/\d/, "passwordDigit"),
    confirm: z.string().min(1, "required"),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "passwordMismatch" });

export const forgotSchema = z.object({ email });

export type FieldErrors = Partial<Record<string, string>>;

/** First error key per field, e.g. { email: "emailInvalid" }. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
