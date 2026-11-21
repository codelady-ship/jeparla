"use client";

import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useRouter } from "@/i18n/navigation";
import { postAuth } from "@/lib/auth/actions";
import { fieldErrors, PASSWORD_MIN, type FieldErrors } from "@/lib/auth/schemas";
import { CITIES } from "@/lib/seller/cities";
import { firstOpenStep, sellerDraft, type SellerDraft } from "@/lib/seller/draft";
import {
  accountStep,
  docsStep,
  LEGAL_TYPES,
  normalizePhone,
  productStep,
  storeStep,
} from "@/lib/seller/schemas";
import { DocUpload } from "./doc-upload";
import { RadioGroupField, SelectField, TextField } from "./fields";
import { SellerDone } from "./seller-done";
import { Stepper } from "./stepper";
import { isMessage } from "@/lib/api/problem";

export type Option = { value: string; label: string };
const STEP_KEYS = ["1", "2", "3", "4"] as const;
const STEPS = STEP_KEYS.length;
const noop = () => () => {};

/**
 * Seller sign-up in four steps (PLAN 5.6). The step is in the URL (?step=2) so
 * the browser Back button moves between steps; the draft is in localStorage so a
 * refresh loses nothing except the password, which is kept in memory only.
 */
export function SellerWizard({
  categories,
  finenesses,
}: {
  categories: Option[];
  finenesses: Option[];
}) {
  const t = useTranslations("Sell");
  const ta = useTranslations("Auth");
  const router = useRouter();
  const params = useSearchParams();
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const draft = useSyncExternalStore(
    sellerDraft.subscribe,
    sellerDraft.get,
    sellerDraft.serverSnapshot,
  );
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const requested = Number(params.get("step")) || 1;
  // Never past the first unfinished step (a shared or stale link cannot skip ahead).
  const step = Math.min(Math.max(requested, 1), firstOpenStep(draft.done), STEPS);
  const titles = STEP_KEYS.map((n) => t(`steps.${n}.title`));

  // Move focus to the new step's heading so screen readers start there.
  const lastStep = useRef(step);
  useEffect(() => {
    if (lastStep.current === step) return;
    lastStep.current = step;
    // After the router has finished its own focus and scroll handling.
    const timer = setTimeout(() => headingRef.current?.focus({ preventScroll: false }), 60);
    return () => clearTimeout(timer);
  }, [step]);

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true" aria-label={t("loading")}>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
    );
  }
  if (draft.submitted) return <SellerDone draft={draft} />;

  const err = (key: string | undefined) => {
    if (!key) return undefined;
    // The backend's own sentence (already in the page language) is shown as it is.
    if (isMessage(key)) return key;
    if (key === "passwordShort") return ta("errors.passwordShort", { min: PASSWORD_MIN });
    // Keys come from the zod schemas; unknown ones fall back to a generic message.
    const k = `errors.${key}` as "errors.server";
    if (t.has(k as "errors.phoneInvalid")) return t(k as "errors.phoneInvalid");
    if (ta.has(k)) return ta(k);
    return ta("errors.server");
  };

  const update = (fn: (d: SellerDraft) => SellerDraft) => sellerDraft.update(fn);
  const goTo = (n: number) => {
    setErrors({});
    router.push(`/sell?step=${n}`, { scroll: false });
  };

  function fail(errs: FieldErrors) {
    setErrors(errs);
    requestAnimationFrame(() => {
      formRef.current
        ?.querySelector<HTMLElement>("[aria-invalid=true], fieldset[aria-describedby]")
        ?.focus();
    });
  }

  function finish(n: number) {
    update((d) => ({ ...d, done: [...new Set([...d.done, n])] }));
    goTo(n + 1);
  }

  async function submit(skipProduct: boolean) {
    if (!password) {
      update((d) => ({ ...d, done: d.done.filter((n) => n !== 1) }));
      goTo(1);
      setErrors({ password: "passwordLost" });
      return;
    }
    setPending(true);
    try {
      const result = await postAuth("/api/auth/seller", {
        account: { ...draft.account, password },
        store: draft.store,
        docs: { docs: draft.docs },
        product: skipProduct ? null : draft.product,
      });
      if (!result.ok) {
        fail(result.errors.form ? result.errors : { form: "server" });
        return;
      }
      setPassword("");
      update((d) => ({ ...d, productSkipped: skipProduct, done: [1, 2, 3, 4], submitted: true }));
      router.replace("/sell", { scroll: true });
    } catch {
      fail({ form: "network" });
    } finally {
      setPending(false);
    }
  }

  function onNext(e: FormEvent) {
    e.preventDefault();
    if (step === 1) {
      const r = accountStep.safeParse({ ...draft.account, password });
      if (!r.success) return fail(fieldErrors(r.error));
      const phone = normalizePhone(draft.account.phone) ?? draft.account.phone;
      update((d) => ({ ...d, account: { ...d.account, phone } }));
      return finish(1);
    }
    if (step === 2) {
      const r = storeStep.safeParse(draft.store);
      if (!r.success) return fail(fieldErrors(r.error));
      return finish(2);
    }
    if (step === 3) {
      const r = docsStep.safeParse({ docs: draft.docs });
      if (!r.success) return fail({ form: "server" });
      return finish(3);
    }
    // A bijouterie store adds its first product in the cabinet (material, not fineness).
    if (fashionOnly) return void submit(true);
    const r = productStep.safeParse(draft.product);
    if (!r.success) return fail(fieldErrors(r.error));
    void submit(false);
  }

  const a = draft.account;
  const s = draft.store;
  const p = draft.product;
  const fashionOnly = s.sellerKind === "FASHION";
  const setAccount = (patch: Partial<SellerDraft["account"]>) =>
    update((d) => ({ ...d, account: { ...d.account, ...patch } }));
  const setStore = (patch: Partial<SellerDraft["store"]>) =>
    update((d) => ({ ...d, store: { ...d.store, ...patch } }));
  const setProduct = (patch: Partial<SellerDraft["product"]>) =>
    update((d) => ({ ...d, product: { ...d.product, ...patch } }));

  return (
    <div className="flex flex-col gap-6">
      <Stepper
        steps={titles}
        current={step}
        done={draft.done}
        onSelect={goTo}
        label={t("progress")}
        doneLabel={t("stepDone")}
      />
      <p className="sr-only" aria-live="polite">
        {t("stepStatus", { step, total: STEPS, title: titles[step - 1] })}
      </p>

      <form
        ref={formRef}
        noValidate
        onSubmit={onNext}
        className="flex flex-col gap-6 rounded-lg border bg-card p-5 sm:p-8"
      >
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">{t("stepOf", { step, total: STEPS })}</p>
          <h2 ref={headingRef} tabIndex={-1} className="text-2xl outline-none">
            {titles[step - 1]}
          </h2>
          <p className="text-sm text-muted-foreground">{t(`steps.${STEP_KEYS[step - 1]}.intro`)}</p>
        </div>

        {errors.form && (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 p-3 text-sm text-destructive"
          >
            {err(errors.form)}
          </p>
        )}

        {step === 1 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              id="s-name"
              label={t("fields.name")}
              autoComplete="name"
              placeholder={t("examples.name")}
              value={a.name}
              onChange={(e) => setAccount({ name: e.target.value })}
              error={err(errors.name)}
            />
            <TextField
              id="s-phone"
              label={t("fields.phone")}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="050 123 45 67"
              value={a.phone}
              onChange={(e) => setAccount({ phone: e.target.value })}
              error={err(errors.phone)}
              hint={t("hints.phone")}
            />
            <TextField
              id="s-password"
              label={t("fields.password")}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={err(errors.password)}
              hint={ta("hints.password", { min: PASSWORD_MIN })}
              className="sm:col-span-2"
            />
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <RadioGroupField
                id="s-kind"
                label={t("sellerKind.question")}
                value={s.sellerKind ?? "PRECIOUS"}
                onChange={(v) => setStore({ sellerKind: v as NonNullable<typeof s.sellerKind> })}
                error={err(errors.sellerKind)}
                options={(["PRECIOUS", "FASHION", "MIXED"] as const).map((k) => ({
                  value: k,
                  label: t(`sellerKind.${k}`),
                  hint: t(`sellerKind.${k}Hint`),
                }))}
              />
            </div>
            <TextField
              id="s-store"
              label={t("fields.storeName")}
              autoComplete="organization"
              placeholder={t("examples.storeName")}
              value={s.storeName}
              onChange={(e) => setStore({ storeName: e.target.value })}
              error={err(errors.storeName)}
            />
            <TextField
              id="s-whatsapp"
              label={t("fields.whatsapp")}
              type="tel"
              inputMode="tel"
              placeholder="050 123 45 67"
              value={s.whatsapp}
              onChange={(e) => setStore({ whatsapp: e.target.value })}
              error={err(errors.whatsapp)}
              hint={t("hints.whatsapp")}
            />
            <SelectField
              id="s-city"
              label={t("fields.city")}
              placeholder={t("choose")}
              options={CITIES.map((c) => ({ value: c, label: c }))}
              value={s.city}
              onChange={(e) => setStore({ city: e.target.value })}
              error={err(errors.city)}
            />
            <TextField
              id="s-address"
              label={t("fields.address")}
              autoComplete="street-address"
              placeholder={t("examples.address")}
              value={s.address}
              onChange={(e) => setStore({ address: e.target.value })}
              error={err(errors.address)}
            />
            <TextField
              id="s-social"
              label={t("fields.social")}
              optional={t("optional")}
              placeholder="@magaza"
              value={s.social}
              onChange={(e) => setStore({ social: e.target.value })}
              error={err(errors.social)}
              hint={t("hints.social")}
              className="sm:col-span-2"
            />
            <div className="sm:col-span-2">
              <RadioGroupField
                id="s-legal"
                label={t("fields.legalType")}
                value={s.legalType}
                onChange={(v) => setStore({ legalType: v as (typeof LEGAL_TYPES)[number] })}
                error={err(errors.legalType)}
                options={LEGAL_TYPES.map((v) => ({
                  value: v,
                  label: t(`legal.${v}`),
                }))}
              />
            </div>
            <TextField
              id="s-tax"
              label={t("fields.taxId")}
              inputMode="numeric"
              maxLength={10}
              placeholder="1234567890"
              value={s.taxId}
              onChange={(e) => setStore({ taxId: e.target.value.replace(/\D/g, "") })}
              error={err(errors.taxId)}
              hint={t("hints.taxId")}
            />
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label htmlFor="s-code" className="flex items-start gap-3 text-sm">
                <input
                  id="s-code"
                  type="checkbox"
                  checked={s.codeAccepted}
                  onChange={(e) => setStore({ codeAccepted: e.target.checked })}
                  aria-invalid={errors.codeAccepted ? true : undefined}
                  aria-describedby={errors.codeAccepted ? "s-code-error" : undefined}
                  className="mt-0.5 size-5 shrink-0 accent-primary"
                />
                <span>
                  {t.rich("fields.codeAccepted", {
                    link: (chunks) => (
                      <Link
                        href="/verified#code"
                        target="_blank"
                        rel="noopener"
                        className="link-underline font-medium"
                      >
                        {chunks}
                      </Link>
                    ),
                    terms: (chunks) => (
                      <Link
                        href="/legal/sellers"
                        target="_blank"
                        rel="noopener"
                        className="link-underline font-medium"
                      >
                        {chunks}
                      </Link>
                    ),
                  })}
                </span>
              </label>
              {errors.codeAccepted && (
                <p id="s-code-error" className="text-sm text-destructive">
                  {err(errors.codeAccepted)}
                </p>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3">
            {fashionOnly ? (
              <p className="text-sm">{t("docs.fashion")}</p>
            ) : (
              <>
                <p className="text-sm">{t("docs.what")}</p>
                {s.sellerKind === "MIXED" && (
                  <p className="text-sm text-muted-foreground">{t("docs.mixed")}</p>
                )}
                <DocUpload docs={draft.docs} onChange={(docs) => update((d) => ({ ...d, docs }))} />
                <p className="text-xs text-muted-foreground">{t("docs.later")}</p>
              </>
            )}
          </div>
        )}

        {step === 4 && fashionOnly && (
          <p className="rounded-lg bg-muted p-4 text-sm">{t("fashionProductLater")}</p>
        )}

        {step === 4 && !fashionOnly && (
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              id="s-product"
              label={t("fields.productName")}
              placeholder={t("examples.productName")}
              value={p.productName}
              onChange={(e) => setProduct({ productName: e.target.value })}
              error={err(errors.productName)}
              className="sm:col-span-2"
            />
            <SelectField
              id="s-category"
              label={t("fields.category")}
              placeholder={t("choose")}
              options={categories}
              value={p.category}
              onChange={(e) => setProduct({ category: e.target.value })}
              error={err(errors.category)}
            />
            <SelectField
              id="s-fineness"
              label={t("fields.fineness")}
              placeholder={t("choose")}
              options={finenesses}
              value={p.fineness}
              onChange={(e) => setProduct({ fineness: e.target.value })}
              error={err(errors.fineness)}
              hint={t("hints.fineness")}
            />
            <TextField
              id="s-weight"
              label={t("fields.weight")}
              inputMode="decimal"
              placeholder="3,25"
              value={p.weight}
              onChange={(e) => setProduct({ weight: e.target.value })}
              error={err(errors.weight)}
            />
            <TextField
              id="s-price"
              label={t("fields.price")}
              inputMode="decimal"
              placeholder="450,00"
              value={p.price}
              onChange={(e) => setProduct({ price: e.target.value })}
              error={err(errors.price)}
            />
            <p className="text-xs text-muted-foreground sm:col-span-2">{t("productDraft")}</p>
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          {step > 1 ? (
            <Button type="button" variant="ghost" onClick={() => goTo(step - 1)}>
              <ArrowLeft aria-hidden />
              {t("back")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            {step === 4 && !fashionOnly && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-11"
                disabled={pending}
                onClick={() => void submit(true)}
              >
                {t("skipProduct")}
              </Button>
            )}
            <Button type="submit" size="lg" className="h-11" disabled={pending}>
              {pending && <Loader2 aria-hidden className="animate-spin" />}
              {step === 4 ? t("finish") : t("next")}
              {step < 4 && <ArrowRight aria-hidden />}
            </Button>
          </div>
        </div>
      </form>
      <p className="text-xs text-muted-foreground">{t("draftNote")}</p>
    </div>
  );
}
