"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import { postAuth } from "@/lib/auth/actions";
import {
  fieldErrors,
  forgotSchema,
  loginSchema,
  registerSchema,
  type FieldErrors,
} from "@/lib/auth/schemas";
import { homeFor, safeNext } from "@/lib/auth/session";

type Kind = "login" | "register" | "forgot";

const FIELDS: Record<Kind, readonly ("name" | "email" | "password" | "confirm")[]> = {
  login: ["email", "password"],
  register: ["name", "email", "password", "confirm"],
  forgot: ["email"],
};
const SCHEMA = { login: loginSchema, register: registerSchema, forgot: forgotSchema };
const ENDPOINT = { login: "/api/auth/login", register: "/api/auth/register", forgot: null };
const AUTOCOMPLETE = {
  name: "name",
  email: "email",
  password: { login: "current-password", register: "new-password", forgot: "off" },
  confirm: "new-password",
} as const;

export type AuthFormLabels = {
  fields: Record<string, string>;
  /** Shown under a field before any error, e.g. password rules. */
  hints: Record<string, string>;
  errors: Record<string, string>;
  submit: string;
  pending: string;
  showPassword: string;
  hidePassword: string;
  /** Forgot-password is a placeholder until SMS/e-mail recovery exists. */
  sentNotice?: string;
};

/**
 * Login, register and forgot-password forms. zod runs in the browser for instant
 * feedback and again in the route handler. Errors sit under each field, the first
 * invalid field gets focus, and the password is never logged or stored here.
 */
export function AuthForm({
  kind,
  labels,
  next,
}: {
  kind: Kind;
  labels: AuthFormLabels;
  next?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const fields = FIELDS[kind];
  const msg = (key: string | undefined) =>
    key ? (labels.errors[key] ?? labels.errors.server) : "";

  function focusFirstError(errs: FieldErrors) {
    const first = fields.find((f) => errs[f]);
    if (first) formRef.current?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(
      fields.map((f) => [f, String(new FormData(e.currentTarget).get(f) ?? "")]),
    );
    const parsed = SCHEMA[kind].safeParse(data);
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      setErrors(errs);
      focusFirstError(errs);
      return;
    }
    setErrors({});
    const endpoint = ENDPOINT[kind];
    if (!endpoint) {
      setSent(true);
      return;
    }
    setPending(true);
    try {
      const result = await postAuth(endpoint, data);
      if (result.ok) {
        router.replace(safeNext(next) ?? homeFor(result.session.role));
        return;
      }
      setErrors(result.errors);
      focusFirstError(result.errors);
    } catch {
      setErrors({ form: "network" });
    } finally {
      setPending(false);
    }
  }

  if (sent && labels.sentNotice) {
    return (
      <p role="status" className="rounded-lg border bg-card p-4 text-sm">
        {labels.sentNotice}
      </p>
    );
  }

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      {errors.form && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 p-3 text-sm text-destructive"
        >
          {msg(errors.form)}
        </p>
      )}
      {fields.map((f) => {
        const id = `${kind}-${f}`;
        const error = errors[f];
        const hint = labels.hints[f];
        const isPassword = f === "password" || f === "confirm";
        const describedBy = [error && `${id}-error`, hint && `${id}-hint`]
          .filter(Boolean)
          .join(" ");
        return (
          <div key={f} className="flex flex-col gap-2">
            <Label htmlFor={id}>{labels.fields[f]}</Label>
            <div className="relative">
              <Input
                id={id}
                name={f}
                type={
                  isPassword
                    ? showPassword
                      ? "text"
                      : "password"
                    : f === "email"
                      ? "email"
                      : "text"
                }
                inputMode={f === "email" ? "email" : undefined}
                autoComplete={f === "password" ? AUTOCOMPLETE.password[kind] : AUTOCOMPLETE[f]}
                autoCapitalize={f === "name" ? "words" : "none"}
                spellCheck={false}
                required
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy || undefined}
                className={isPassword ? "h-11 pr-11" : "h-11"}
              />
              {f === "password" && (
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? labels.hidePassword : labels.showPassword}
                  aria-pressed={showPassword}
                  className="absolute top-1/2 right-1 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none after:absolute after:-inset-1 after:content-[''] hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {showPassword ? (
                    <EyeOff aria-hidden className="size-4" />
                  ) : (
                    <Eye aria-hidden className="size-4" />
                  )}
                </button>
              )}
            </div>
            {hint && (
              <p id={`${id}-hint`} className="text-xs text-muted-foreground">
                {hint}
              </p>
            )}
            {error && (
              <p id={`${id}-error`} className="text-sm text-destructive">
                {msg(error)}
              </p>
            )}
          </div>
        );
      })}
      <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
        {pending && <Loader2 aria-hidden className="animate-spin" />}
        {pending ? labels.pending : labels.submit}
      </Button>
    </form>
  );
}
