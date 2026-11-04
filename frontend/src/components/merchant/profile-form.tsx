"use client";

import { Copy, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { SelectField, TextField } from "@/components/sell/fields";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { sendJson } from "@/lib/merchant/client";
import { formatWeek, invalidDays, parseWeek, WEEK, type WeekHours } from "@/lib/merchant/hours";
import { pathErrors, profileSchema, type ProfileInput } from "@/lib/merchant/schemas";
import { notices } from "@/lib/notice";
import { CITIES } from "@/lib/seller/cities";

/** Store profile and weekly opening hours (PLAN 5.7 "profile"). */
export function ProfileForm({ initial }: { initial: ProfileInput }) {
  const t = useTranslations("Merchant.profile");
  const tm = useTranslations("Merchant");
  const ts = useTranslations("Sell");
  const ta = useTranslations("Auth");
  const [form, setForm] = useState(initial);
  const [week, setWeek] = useState<WeekHours>(() => parseWeek(initial.openingHours));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // After a failed check, move focus to the first invalid field once React has rendered it.
  const focusError = useRef(false);
  useEffect(() => {
    if (!focusError.current) return;
    focusError.current = false;
    formRef.current?.querySelector<HTMLElement>("[aria-invalid=true], [role=alert]")?.focus();
  }, [errors]);
  const badDays = invalidDays(week);

  const err = (key: string | undefined) => {
    if (!key) return undefined;
    const k = `errors.${key}`;
    if (tm.has(k as "errors.check")) return tm(k as "errors.check");
    if (ts.has(k as "errors.phoneInvalid")) return ts(k as "errors.phoneInvalid");
    if (ta.has(k as "errors.server")) return ta(k as "errors.server");
    return ta("errors.server");
  };
  const set = (patch: Partial<ProfileInput>) => setForm((f) => ({ ...f, ...patch }));
  const setDay = (i: number, patch: Partial<WeekHours[number]>) =>
    setWeek((w) => w.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  function fail(errs: Record<string, string>) {
    setErrors(errs);
    focusError.current = true;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const body = { ...form, openingHours: formatWeek(week) };
    const r = profileSchema.safeParse(body);
    if (!r.success) return fail(pathErrors(r.error));
    if (badDays.length) return fail({ form: "hoursInvalid" });
    setPending(true);
    const result = await sendJson<{ profile: ProfileInput }>("PUT", "/api/merchant/profile", body);
    setPending(false);
    if (!result.ok)
      return fail(result.errors.form ? result.errors : { ...result.errors, form: "check" });
    setErrors({});
    setForm(result.data.profile);
    notices.show(t("saved"));
  }

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} className="flex flex-col gap-6">
      {errors.form && (
        <p
          role="alert"
          tabIndex={-1}
          className="rounded-md border border-destructive/40 p-3 text-sm text-destructive outline-none"
        >
          {err(errors.form)}
        </p>
      )}

      <div className="grid gap-5 rounded-lg border bg-card p-4 sm:grid-cols-2 sm:p-6">
        <TextField
          id="pr-name"
          label={t("fields.name")}
          autoComplete="organization"
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          error={err(errors.name)}
        />
        <TextField
          id="pr-whatsapp"
          label={t("fields.whatsapp")}
          type="tel"
          inputMode="tel"
          placeholder="050 123 45 67"
          value={form.whatsapp}
          onChange={(e) => set({ whatsapp: e.target.value })}
          error={err(errors.whatsapp)}
          hint={ts("hints.whatsapp")}
        />
        <SelectField
          id="pr-city"
          label={t("fields.city")}
          placeholder={ts("choose")}
          options={CITIES.map((c) => ({ value: c, label: c }))}
          value={form.city}
          onChange={(e) => set({ city: e.target.value })}
          error={err(errors.city)}
        />
        <TextField
          id="pr-address"
          label={t("fields.address")}
          autoComplete="street-address"
          value={form.address}
          onChange={(e) => set({ address: e.target.value })}
          error={err(errors.address)}
        />
        <TextField
          id="pr-social"
          label={t("fields.social")}
          optional={ts("optional")}
          placeholder="@magaza"
          value={form.social}
          onChange={(e) => set({ social: e.target.value })}
          error={err(errors.social)}
          hint={ts("hints.social")}
          className="sm:col-span-2"
        />
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="pr-description">
            {t("fields.description")}
            <span className="font-normal text-muted-foreground">({ts("optional")})</span>
          </Label>
          <textarea
            id="pr-description"
            rows={4}
            maxLength={1000}
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={errors.description ? "pr-description-error" : undefined}
            className="rounded-lg border border-input bg-background px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm"
          />
          {errors.description && (
            <p id="pr-description-error" className="text-sm text-destructive">
              {err(errors.description)}
            </p>
          )}
        </div>
      </div>

      <fieldset className="flex min-w-0 flex-col gap-4 rounded-lg border bg-card p-4 sm:p-6">
        <legend className="float-left mb-1 w-full font-heading text-xl">{t("hours.title")}</legend>
        <p className="clear-both text-sm text-muted-foreground">{t("hours.intro")}</p>
        <ul className="flex flex-col divide-y">
          {WEEK.map((code, i) => {
            const day = week[i];
            const name = t(`days.${code}`);
            const bad = badDays.includes(i);
            return (
              <li
                key={code}
                className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 py-3 sm:grid-cols-[12rem_1fr]"
              >
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={day.open}
                    onChange={(e) => setDay(i, { open: e.target.checked })}
                    aria-label={t("hours.open", { day: name })}
                    className="size-4 accent-primary"
                  />
                  <span aria-hidden>{name}</span>
                </label>
                {day.open ? (
                  <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1">
                    <input
                      type="time"
                      value={day.from}
                      onChange={(e) => setDay(i, { from: e.target.value })}
                      aria-label={t("hours.from", { day: name })}
                      aria-invalid={bad || undefined}
                      aria-describedby={bad ? `hours-${code}-error` : undefined}
                      className="h-11 rounded-lg border border-input bg-background px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm"
                    />
                    <span aria-hidden>{"–"}</span>
                    <input
                      type="time"
                      value={day.to}
                      onChange={(e) => setDay(i, { to: e.target.value })}
                      aria-label={t("hours.to", { day: name })}
                      aria-invalid={bad || undefined}
                      aria-describedby={bad ? `hours-${code}-error` : undefined}
                      className="h-11 rounded-lg border border-input bg-background px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm"
                    />
                    {bad && (
                      <p id={`hours-${code}-error`} className="w-full text-sm text-destructive">
                        {t("hours.invalid")}
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground sm:col-span-1">
                    {t("hours.closed")}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-auto min-h-9 self-start py-2 text-left whitespace-normal"
          disabled={!week[0].open}
          onClick={() =>
            setWeek((w) => w.map((d) => (d.open ? { ...d, from: w[0].from, to: w[0].to } : d)))
          }
        >
          <Copy aria-hidden />
          {t("hours.copy")}
        </Button>
      </fieldset>

      <Button type="submit" size="lg" className="h-11 self-start" disabled={pending}>
        {pending && <Loader2 aria-hidden className="animate-spin" />}
        {t("save")}
      </Button>
    </form>
  );
}
