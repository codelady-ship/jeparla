"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { DocUpload } from "@/components/sell/doc-upload";
import { RadioGroupField, SelectField, TextField } from "@/components/sell/fields";
import { Stepper } from "@/components/sell/stepper";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/lib/money";
import { sendJson } from "@/lib/merchant/client";
import type { MerchantVideo } from "@/lib/merchant/video";
import { firstOpenStep, productDraft, STEPS, type ProductDraft } from "@/lib/merchant/draft";
import {
  basicsStep,
  docsStep,
  imagesStep,
  KEY_FEATURE_LENGTH,
  MAX_KEY_FEATURES,
  MAX_STONES,
  MAX_VARIANTS,
  metalStep,
  pathErrors,
  stonesStep,
} from "@/lib/merchant/schemas";
import type { DocMeta } from "@/lib/seller/schemas";
import type { MetalType, ProductStatus, StockStatus, StoneType } from "@/types/api";
import {
  DIMENSION_KEYS,
  FASHION_MATERIALS,
  PRODUCT_AUDIENCES,
  type MaterialKind,
  type ProductAudience,
  type SellerKind,
  type ProductInput,
  type StoneInput,
  type VariantInput,
} from "@/types/merchant";
import { EvidenceUpload } from "./evidence-upload";
import { VideoUpload } from "./video-upload";
import { ImageUpload } from "./image-upload";
import { PricingFields, previewPrice, type GramQuote } from "./pricing-fields";
import { isMessage } from "@/lib/api/problem";

export type Option = { value: string; label: string };
/** A leaf category with the audience it suggests (#121). */
export type CategoryOption = Option & { audience?: ProductAudience };
export type FinenessOption = Option & { metal: MetalType; fineness: number };

const STEP_KEYS = ["1", "2", "3", "4", "5"] as const;
const METALS: MetalType[] = ["GOLD", "SILVER", "PLATINUM", "PALLADIUM"];
const STOCK: StockStatus[] = ["IN_STOCK", "MADE_TO_ORDER", "OUT_OF_STOCK"];
const STONES: StoneType[] = ["DIAMOND", "RUBY", "SAPPHIRE", "EMERALD", "PEARL", "CUBIC_ZIRCONIA"];
const noop = () => () => {};
/** The first per-line key feature error ("keyFeatures.2": "keyFeatureLong"), if any. */
const firstKeyFeatureError = (errors: Record<string, string>) =>
  Object.entries(errors).find(([k]) => k.startsWith("keyFeatures."))?.[1];
const newKey = (p: string) => `${p}${Date.now().toString(36)}${Math.floor(performance.now())}`;

/**
 * Product form in five short steps (PLAN 5.7, "simple like Vinted"). Every
 * change goes to a localStorage draft at once; the server only sees the product
 * when the merchant saves a draft or sends it to review. A seller that is not
 * approved yet never sees the review button (PLAN 5.9).
 */
export function ProductForm({
  draftKey,
  initial,
  productStatus,
  productId,
  video,
  categories,
  finenesses,
  sellerApproved,
  quotes,
  requireDocs = true,
  sellerKind = "PRECIOUS",
  occasions = [],
}: {
  /** Shown occasion collections (#115) the seller can tag the product with; value = id. */
  occasions?: Option[];
  /** What the store sells (#128): FASHION stores add bijouterie, MIXED stores choose per new product. */
  sellerKind?: SellerKind;
  /** "new" or the product id. */
  draftKey: string;
  initial?: ProductInput;
  productStatus?: ProductStatus;
  /** The saved product: its id and video (#117). The video is uploaded on its own, not with the form. */
  productId?: number;
  video?: MerchantVideo | null;
  categories: CategoryOption[];
  finenesses: FinenessOption[];
  sellerApproved: boolean;
  /** Latest pure-metal gram price per metal, for the METAL_LINKED preview. */
  quotes: Partial<Record<MetalType, GramQuote>>;
  /**
   * Sample data only: the form asks for expertise documents before review. With the backend
   * they are separate private uploads checked by an admin (#40), not part of this form.
   */
  requireDocs?: boolean;
}) {
  const t = useTranslations("Merchant.form");
  const locale = useLocale();
  const tm = useTranslations("Merchant");
  const tp = useTranslations("Product");
  const tpd = useTranslations("Pdp");
  const ts = useTranslations("Sell");
  const ta = useTranslations("Auth");
  const store = productDraft(draftKey, initial);
  // "new" or "draft-<id>" (a photo draft, #109) create a product; a number edits one.
  const creating = draftKey === "new" || draftKey.startsWith("draft-");
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const draft = useSyncExternalStore(store.subscribe, store.get, store.serverSnapshot);
  const [step, setStep] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<"DRAFT" | "REVIEW" | null>(null);
  const [done, setDone] = useState<"DRAFT" | "IN_REVIEW" | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // After a failed check, move focus to the first invalid field once React has rendered it.
  const focusError = useRef(false);
  useEffect(() => {
    if (!focusError.current) return;
    focusError.current = false;
    formRef.current?.querySelector<HTMLElement>("[aria-invalid=true], [role=alert]")?.focus();
  }, [errors]);

  const current = step ?? firstOpenStep(draft.done);
  const titles = STEP_KEYS.map((n) => t(`steps.${n}.title`));

  const lastStep = useRef(current);
  useEffect(() => {
    if (lastStep.current === current) return;
    lastStep.current = current;
    const timer = setTimeout(() => headingRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [current]);

  if (!hydrated)
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );

  if (done)
    return (
      <section className="flex flex-col items-center gap-4 rounded-lg border bg-card px-4 py-12 text-center">
        <CheckCircle2 aria-hidden className="size-10 text-success" />
        <h2 className="text-2xl" tabIndex={-1} ref={(el) => el?.focus()}>
          {t(`done.${done}.title`)}
        </h2>
        <p className="max-w-md text-muted-foreground">{t(`done.${done}.text`)}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/merchant/products" className={buttonVariants({ size: "lg" })}>
            {t("done.toList")}
          </Link>
          <Link
            href="/merchant/products/new"
            className={buttonVariants({ variant: "outline", size: "lg" })}
            onClick={() => setDone(null)}
          >
            {t("done.another")}
          </Link>
        </div>
      </section>
    );

  const p = draft.input;
  // Bijouterie (#128): the stored product's kind; a new one follows the store, a MIXED store chooses.
  const kind: MaterialKind = p.materialKind ?? (sellerKind === "FASHION" ? "FASHION" : "PRECIOUS");
  const fashion = kind === "FASHION";
  const chooseKind = sellerKind === "MIXED" && creating;
  const withKind = { ...p, materialKind: kind };
  const update = (fn: (d: ProductDraft) => ProductDraft) => store.update(fn);
  const set = (patch: Partial<ProductInput>) =>
    update((d) => ({ ...d, input: { ...d.input, ...patch } }));
  const setVariant = (key: string, patch: Partial<VariantInput>) =>
    set({ variants: p.variants.map((v) => (v.key === key ? { ...v, ...patch } : v)) });
  const setStone = (key: string, patch: Partial<StoneInput>) =>
    set({ stones: p.stones.map((s) => (s.key === key ? { ...s, ...patch } : s)) });

  const err = (key: string | undefined) => {
    if (!key) return undefined;
    // The backend's own sentence (already in the page language) is shown as it is.
    if (isMessage(key)) return key;
    const k = `errors.${key}`;
    if (tm.has(k as "errors.check")) return tm(k as "errors.check");
    if (ts.has(k as "errors.phoneInvalid")) return ts(k as "errors.phoneInvalid");
    if (ta.has(k as "errors.server")) return ta(k as "errors.server");
    return ta("errors.server");
  };

  function goTo(n: number) {
    setErrors({});
    setStep(n);
  }

  function fail(errs: Record<string, string>) {
    setErrors(errs);
    focusError.current = true;
  }

  /** Checks one step; returns its errors (empty when fine). */
  function check(n: number): Record<string, string> {
    const schema = [imagesStep, basicsStep, metalStep, stonesStep, docsStep][n - 1];
    const r = schema.safeParse(withKind);
    return r.success ? {} : pathErrors(r.error);
  }

  function onNext(e: FormEvent) {
    e.preventDefault();
    const errs = check(current);
    if (Object.keys(errs).length) return fail(errs);
    update((d) => ({ ...d, done: [...new Set([...d.done, current])] }));
    goTo(Math.min(current + 1, STEPS));
  }

  async function submit(intent: "DRAFT" | "REVIEW") {
    // Every step must pass before anything goes to the server.
    for (let n = 1; n <= STEPS; n++) {
      const errs = check(n);
      if (Object.keys(errs).length) {
        goTo(n);
        return fail(errs);
      }
    }
    if (
      requireDocs &&
      !fashion &&
      intent === "REVIEW" &&
      p.docs.length === 0 &&
      productStatus !== "APPROVED"
    )
      return fail({ form: "docsRequired" });
    setPending(intent);
    const result = creating
      ? await sendJson<{ status: "DRAFT" | "IN_REVIEW" }>("POST", "/api/merchant/products", {
          intent,
          product: withKind,
        })
      : await sendJson<{ status: "DRAFT" | "IN_REVIEW" }>(
          "PUT",
          `/api/merchant/products/${draftKey}`,
          { intent, product: withKind },
        );
    setPending(null);
    if (!result.ok) {
      const errs = result.errors;
      return fail(errs.form ? errs : { ...errs, form: "check" });
    }
    store.clear();
    setStep(null);
    setDone(result.data.status);
  }

  const time = draft.savedAt ? new Date(draft.savedAt).toTimeString().slice(0, 5) : null;
  const metalFinenesses = finenesses.filter((f) => f.metal === p.metal);
  const finenessValue = finenesses.find((f) => f.value === p.fineness)?.fineness ?? null;
  const quote = p.metal ? (quotes[p.metal] ?? null) : null;
  const linked = !fashion && p.pricingMode === "METAL_LINKED";

  return (
    <div className="flex flex-col gap-6">
      <Stepper
        steps={titles}
        current={current}
        done={draft.done}
        onSelect={goTo}
        label={t("progress")}
        doneLabel={t("stepDone")}
      />
      <p className="sr-only" aria-live="polite">
        {t("stepStatus", { step: current, total: STEPS, title: titles[current - 1] })}
      </p>

      <form
        ref={formRef}
        noValidate
        onSubmit={onNext}
        className="flex flex-col gap-6 rounded-lg border bg-card p-4 sm:p-8"
      >
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            {t("stepOf", { step: current, total: STEPS })}
          </p>
          <h2 ref={headingRef} tabIndex={-1} className="text-2xl outline-none">
            {titles[current - 1]}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t(`steps.${STEP_KEYS[current - 1]}.intro`)}
          </p>
        </div>

        {errors.form && (
          <p
            role="alert"
            tabIndex={-1}
            className="rounded-md border border-destructive/40 p-3 text-sm text-destructive outline-none"
          >
            {err(errors.form)}
          </p>
        )}

        {current === 1 && (
          <div className="flex flex-col gap-2">
            <ImageUpload
              images={p.images}
              onChange={(images) => set({ images })}
              invalid={Boolean(errors.images)}
              describedBy={errors.images ? "images-error" : undefined}
            />
            {errors.images && (
              <p id="images-error" className="text-sm text-destructive">
                {err(errors.images)}
              </p>
            )}
            <div className="mt-4 border-t pt-5">
              <EvidenceUpload
                value={p.evidence ?? {}}
                materialKind={kind}
                onChange={(evidence) => set({ evidence })}
              />
            </div>
            <div className="mt-4 border-t pt-5">
              <VideoUpload
                productId={productId ?? null}
                initial={video ?? null}
                listed={productStatus === "APPROVED"}
              />
            </div>
          </div>
        )}

        {current === 2 && (
          <div className="grid gap-5 sm:grid-cols-2">
            {chooseKind && (
              <div className="sm:col-span-2">
                <RadioGroupField
                  id="p-kind"
                  label={t("kind.label")}
                  value={kind}
                  onChange={(v) =>
                    set(
                      v === "FASHION"
                        ? { materialKind: "FASHION", pricingMode: "FIXED" }
                        : { materialKind: "PRECIOUS" },
                    )
                  }
                  options={(["PRECIOUS", "FASHION"] as const).map((k) => ({
                    value: k,
                    label: t(`kind.${k}`),
                    hint: t(`kind.${k}Hint`),
                  }))}
                />
              </div>
            )}
            <TextField
              id="p-name"
              label={t("fields.name")}
              value={p.name}
              onChange={(e) => set({ name: e.target.value })}
              error={err(errors.name)}
              hint={t("hints.name")}
              className="sm:col-span-2"
            />
            <SelectField
              id="p-category"
              label={t("fields.category")}
              placeholder={t("choose")}
              options={categories}
              value={p.category}
              onChange={(e) => {
                const suggested = (slug: string) =>
                  categories.find((c) => c.value === slug)?.audience ?? "UNISEX";
                // The suggestion follows the category until the seller picks an audience.
                const touched = p.audience !== suggested(p.category);
                set({
                  category: e.target.value,
                  ...(touched ? {} : { audience: suggested(e.target.value) }),
                });
              }}
              error={err(errors.category)}
            />
            <SelectField
              id="p-audience"
              label={t("fields.audience")}
              placeholder={t("choose")}
              options={PRODUCT_AUDIENCES.map((a) => ({ value: a, label: t(`audience.${a}`) }))}
              value={p.audience}
              onChange={(e) => set({ audience: (e.target.value || "UNISEX") as ProductAudience })}
              hint={t("hints.audience")}
            />
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="p-description">
                {t("fields.description")}
                <span className="font-normal text-muted-foreground">({t("optional")})</span>
              </Label>
              <textarea
                id="p-description"
                rows={5}
                maxLength={2000}
                value={p.description}
                onChange={(e) => set({ description: e.target.value })}
                aria-invalid={errors.description ? true : undefined}
                aria-describedby={`p-description-hint${errors.description ? " p-description-error" : ""}`}
                className="rounded-lg border border-input bg-background px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm"
              />
              <p id="p-description-hint" className="text-xs text-muted-foreground">
                {t("hints.description")}
              </p>
              {errors.description && (
                <p id="p-description-error" className="text-sm text-destructive">
                  {err(errors.description)}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="p-features">
                {t("fields.keyFeatures")}
                <span className="font-normal text-muted-foreground">({t("optional")})</span>
              </Label>
              <textarea
                id="p-features"
                rows={4}
                value={(p.keyFeatures ?? []).join("\n")}
                onChange={(e) => set({ keyFeatures: e.target.value.split("\n") })}
                aria-invalid={errors.keyFeatures ? true : undefined}
                aria-describedby={`p-features-hint${errors.keyFeatures ? " p-features-error" : ""}`}
                className="rounded-lg border border-input bg-background px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm"
              />
              <p id="p-features-hint" className="text-xs text-muted-foreground">
                {t("hints.keyFeatures", { max: MAX_KEY_FEATURES, length: KEY_FEATURE_LENGTH })}
              </p>
              {(errors.keyFeatures ?? firstKeyFeatureError(errors)) && (
                <p id="p-features-error" className="text-sm text-destructive">
                  {err(errors.keyFeatures ?? firstKeyFeatureError(errors))}
                </p>
              )}
            </div>
            {occasions.length > 0 && (
              <fieldset
                className="flex min-w-0 flex-col gap-3 sm:col-span-2"
                aria-describedby="p-occasions-hint"
              >
                <legend className="mb-1 text-sm font-medium">
                  {t("fields.occasions")}{" "}
                  <span className="font-normal text-muted-foreground">({t("optional")})</span>
                </legend>
                <p id="p-occasions-hint" className="text-xs text-muted-foreground">
                  {t("hints.occasions")}
                </p>
                <ul className="flex flex-wrap gap-2">
                  {occasions.map((o) => {
                    const id = Number(o.value);
                    const checked = (p.collectionIds ?? []).includes(id);
                    return (
                      <li key={o.value}>
                        <label
                          htmlFor={`p-occasion-${o.value}`}
                          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border bg-card px-4 text-sm transition-colors hover:bg-muted has-checked:border-primary has-checked:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
                        >
                          <input
                            id={`p-occasion-${o.value}`}
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const rest = (p.collectionIds ?? []).filter((x) => x !== id);
                              set({ collectionIds: e.target.checked ? [...rest, id] : rest });
                            }}
                            className="size-4 accent-primary"
                          />
                          {o.label}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            )}
            <fieldset className="flex min-w-0 flex-col gap-3 rounded-lg border p-4 sm:col-span-2">
              <legend className="px-1 text-sm font-semibold">
                {t("dimensions.title")}{" "}
                <span className="font-normal text-muted-foreground">({t("optional")})</span>
              </legend>
              <p className="text-xs text-muted-foreground">{t("dimensions.hint")}</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {DIMENSION_KEYS.map((k) => (
                  <TextField
                    key={k}
                    id={`p-dim-${k}`}
                    label={t(`dimensions.${k}`)}
                    inputMode="decimal"
                    placeholder="2,5"
                    value={p.dimensions?.[k] ?? ""}
                    onChange={(e) => set({ dimensions: { ...p.dimensions, [k]: e.target.value } })}
                    error={err(errors[`dimensions.${k}`])}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {current === 3 && (
          <div className="flex flex-col gap-6">
            {fashion ? (
              <div className="flex flex-col gap-4">
                <SelectField
                  id="p-material"
                  label={t("fields.material")}
                  placeholder={t("choose")}
                  options={FASHION_MATERIALS.map((m) => ({ value: m, label: tp(`material.${m}`) }))}
                  value={p.material ?? ""}
                  onChange={(e) => set({ material: e.target.value as ProductInput["material"] })}
                  error={err(errors.material)}
                  hint={t("hints.material")}
                />
                <p className="text-sm text-muted-foreground">{t("hints.fashionPrice")}</p>
                <div className="flex flex-col gap-1">
                  <label htmlFor="p-not-precious" className="flex items-start gap-3 text-sm">
                    <input
                      id="p-not-precious"
                      type="checkbox"
                      checked={p.notPreciousConfirmed === true}
                      onChange={(e) => set({ notPreciousConfirmed: e.target.checked })}
                      aria-invalid={errors.notPreciousConfirmed ? true : undefined}
                      aria-describedby={
                        errors.notPreciousConfirmed ? "p-not-precious-error" : undefined
                      }
                      className="mt-0.5 size-5 shrink-0 accent-primary"
                    />
                    <span>{t("fields.notPrecious")}</span>
                  </label>
                  {errors.notPreciousConfirmed && (
                    <p id="p-not-precious-error" className="text-sm text-destructive">
                      {err(errors.notPreciousConfirmed)}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                <SelectField
                  id="p-metal"
                  label={t("fields.metal")}
                  placeholder={t("choose")}
                  options={METALS.map((m) => ({ value: m, label: tp(`metal.${m}`) }))}
                  value={p.metal}
                  onChange={(e) => set({ metal: e.target.value as MetalType, fineness: "" })}
                  error={err(errors.metal)}
                />
                <SelectField
                  id="p-fineness"
                  label={t("fields.fineness")}
                  placeholder={t("choose")}
                  options={metalFinenesses}
                  value={p.fineness}
                  disabled={!p.metal}
                  onChange={(e) => set({ fineness: e.target.value })}
                  error={err(errors.fineness)}
                  hint={p.metal ? undefined : t("hints.fineness")}
                />
              </div>
            )}

            {!fashion && (
              <PricingFields
                mode={p.pricingMode}
                pricing={p.pricing}
                variants={p.variants}
                fineness={finenessValue}
                quote={quote}
                errors={errors}
                err={err}
                onMode={(pricingMode) => set({ pricingMode })}
                onPricing={(patch) => set({ pricing: { ...p.pricing, ...patch } })}
              />
            )}

            <ol className="flex flex-col gap-4">
              {p.variants.map((v, i) => (
                <li key={v.key}>
                  <fieldset className="flex min-w-0 flex-col gap-4 rounded-lg border p-4">
                    <legend className="px-1 text-sm font-semibold">
                      {t("variants.title", { n: i + 1 })}
                    </legend>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <TextField
                        id={`v-${v.key}-weight`}
                        label={t("fields.weight")}
                        optional={fashion ? t("optional") : undefined}
                        inputMode="decimal"
                        placeholder="3,25"
                        value={v.weightGrams}
                        onChange={(e) => setVariant(v.key, { weightGrams: e.target.value })}
                        error={err(errors[`variants.${i}.weightGrams`])}
                      />
                      {linked ? (
                        <div className="flex flex-col gap-2">
                          <span className="text-sm font-medium">{t("pricing.computed")}</span>
                          <span className="flex h-11 items-center text-base font-semibold tabular-nums">
                            {(() => {
                              const b = previewPrice(v, finenessValue, quote, p.pricing);
                              return b ? formatPrice(b.total, locale) : t("pricing.pending");
                            })()}
                          </span>
                        </div>
                      ) : (
                        <TextField
                          id={`v-${v.key}-price`}
                          label={t("fields.price")}
                          inputMode="decimal"
                          placeholder="450,00"
                          value={v.price}
                          onChange={(e) => setVariant(v.key, { price: e.target.value })}
                          error={err(errors[`variants.${i}.price`])}
                        />
                      )}
                      <TextField
                        id={`v-${v.key}-size`}
                        label={t("fields.size")}
                        optional={t("optional")}
                        value={v.size}
                        onChange={(e) => setVariant(v.key, { size: e.target.value })}
                        error={err(errors[`variants.${i}.size`])}
                      />
                      <SelectField
                        id={`v-${v.key}-stock`}
                        label={t("fields.stock")}
                        placeholder={t("choose")}
                        options={STOCK.map((s) => ({ value: s, label: tp(`stock.${s}`) }))}
                        value={v.stockStatus}
                        onChange={(e) =>
                          setVariant(v.key, { stockStatus: e.target.value as StockStatus })
                        }
                      />
                    </div>
                    {i === 0 && !linked && (
                      <p className="text-xs text-muted-foreground">{t("hints.price")}</p>
                    )}
                    {p.variants.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="lg"
                        className="self-start"
                        onClick={() => set({ variants: p.variants.filter((x) => x.key !== v.key) })}
                      >
                        <Trash2 aria-hidden />
                        {t("variants.remove", { n: i + 1 })}
                      </Button>
                    )}
                  </fieldset>
                </li>
              ))}
            </ol>
            {p.variants.length < MAX_VARIANTS ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="self-start"
                onClick={() =>
                  set({
                    variants: [
                      ...p.variants,
                      {
                        key: newKey("v"),
                        size: "",
                        weightGrams: "",
                        price: "",
                        stockStatus: "IN_STOCK",
                      },
                    ],
                  })
                }
              >
                <Plus aria-hidden />
                {t("variants.add")}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("variants.max", { max: MAX_VARIANTS })}
              </p>
            )}
          </div>
        )}

        {current === 4 && (
          <div className="flex flex-col gap-4">
            {p.stones.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("stones.none")}</p>
            )}
            <ol className="flex flex-col gap-4">
              {p.stones.map((s, i) => (
                <li key={s.key}>
                  <fieldset className="flex min-w-0 flex-col gap-4 rounded-lg border p-4">
                    <legend className="px-1 text-sm font-semibold">
                      {t("stones.title", { n: i + 1 })}
                    </legend>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <SelectField
                        id={`s-${s.key}-type`}
                        label={t("fields.stoneType")}
                        placeholder={t("choose")}
                        options={STONES.map((v) => ({ value: v, label: tpd(`stoneType.${v}`) }))}
                        value={s.type}
                        onChange={(e) => setStone(s.key, { type: e.target.value as StoneType })}
                        error={err(errors[`stones.${i}.type`])}
                      />
                      <SelectField
                        id={`s-${s.key}-origin`}
                        label={t("fields.origin")}
                        placeholder={t("choose")}
                        options={[
                          { value: "NATURAL", label: t("stones.natural") },
                          { value: "LAB_GROWN", label: t("stones.labGrown") },
                        ]}
                        value={s.origin}
                        onChange={(e) =>
                          setStone(s.key, { origin: e.target.value as StoneInput["origin"] })
                        }
                      />
                      <TextField
                        id={`s-${s.key}-count`}
                        label={t("fields.count")}
                        inputMode="numeric"
                        value={s.count}
                        onChange={(e) => setStone(s.key, { count: e.target.value })}
                        error={err(errors[`stones.${i}.count`])}
                      />
                      <TextField
                        id={`s-${s.key}-carat`}
                        label={t("fields.carat")}
                        optional={t("optional")}
                        inputMode="decimal"
                        placeholder="0,50"
                        value={s.carat}
                        onChange={(e) => setStone(s.key, { carat: e.target.value })}
                        error={err(errors[`stones.${i}.carat`])}
                      />
                      <TextField
                        id={`s-${s.key}-lab`}
                        label={t("fields.certificateLab")}
                        optional={t("optional")}
                        placeholder="GIA"
                        value={s.certificateLab}
                        onChange={(e) => setStone(s.key, { certificateLab: e.target.value })}
                        error={err(errors[`stones.${i}.certificateLab`])}
                      />
                      <TextField
                        id={`s-${s.key}-cert`}
                        label={t("fields.certificateNumber")}
                        optional={t("optional")}
                        value={s.certificateNumber}
                        onChange={(e) => setStone(s.key, { certificateNumber: e.target.value })}
                        error={err(errors[`stones.${i}.certificateNumber`])}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      className="self-start"
                      onClick={() => set({ stones: p.stones.filter((x) => x.key !== s.key) })}
                    >
                      <Trash2 aria-hidden />
                      {t("stones.remove", { n: i + 1 })}
                    </Button>
                  </fieldset>
                </li>
              ))}
            </ol>
            {p.stones.length < MAX_STONES && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="self-start"
                onClick={() =>
                  set({
                    stones: [
                      ...p.stones,
                      {
                        key: newKey("s"),
                        type: "",
                        origin: "NATURAL",
                        carat: "",
                        count: "1",
                        certificateLab: "",
                        certificateNumber: "",
                      },
                    ],
                  })
                }
              >
                <Plus aria-hidden />
                {t("stones.add")}
              </Button>
            )}
          </div>
        )}

        {current === 5 && (
          <div className="flex flex-col gap-5">
            {fashion ? (
              <p className="text-sm">{t("docs.fashion")}</p>
            ) : (
              <>
                <p className="text-sm">{t("docs.what")}</p>
                {!requireDocs && (
                  <p className="text-sm text-muted-foreground">{t("docs.separate")}</p>
                )}
                <DocUpload docs={p.docs as DocMeta[]} onChange={(docs) => set({ docs })} />
              </>
            )}
            <div className="flex flex-col gap-2 rounded-lg bg-muted p-4 text-sm">
              <h3 className="font-sans font-semibold">{t("review.title")}</h3>
              {sellerApproved ? (
                <>
                  <p>{t("review.ready")}</p>
                  {requireDocs &&
                    !fashion &&
                    p.docs.length === 0 &&
                    productStatus !== "APPROVED" && (
                      <p className="text-muted-foreground">{t("review.docsNeeded")}</p>
                    )}
                  {productStatus === "APPROVED" && (
                    <p className="text-muted-foreground">{t("review.liveNote")}</p>
                  )}
                </>
              ) : (
                <p>{err("sellerNotApproved")}</p>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          {current > 1 ? (
            <Button type="button" variant="ghost" size="lg" onClick={() => goTo(current - 1)}>
              <ArrowLeft aria-hidden />
              {t("back")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            {current === STEPS ? (
              <>
                <Button
                  type="button"
                  variant={sellerApproved ? "outline" : "default"}
                  size="lg"
                  className="h-11"
                  disabled={pending !== null}
                  onClick={() => void submit("DRAFT")}
                >
                  {pending === "DRAFT" && <Loader2 aria-hidden className="animate-spin" />}
                  {t("saveDraft")}
                </Button>
                {sellerApproved && (
                  <Button
                    type="button"
                    size="lg"
                    className="h-11"
                    disabled={pending !== null}
                    onClick={() => void submit("REVIEW")}
                  >
                    {pending === "REVIEW" && <Loader2 aria-hidden className="animate-spin" />}
                    {t("submitReview")}
                  </Button>
                )}
              </>
            ) : (
              <Button type="submit" size="lg" className="h-11">
                {t("next")}
                <ArrowRight aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </form>

      <div className="flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite">
          {!store.persisted() ? t("notPersisted") : time ? t("savedAt", { time }) : t("intro")}
        </p>
        {draft.savedAt &&
          (confirmDiscard ? (
            <div className="flex flex-wrap items-center gap-2" role="group">
              <span className="text-sm text-foreground">{t("discardConfirm")}</span>
              <Button
                type="button"
                variant="destructive"
                size="lg"
                onClick={() => {
                  store.clear();
                  setConfirmDiscard(false);
                  setErrors({});
                  setStep(1);
                }}
              >
                {t("discardYes")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => setConfirmDiscard(false)}
              >
                {t("discardNo")}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="self-start"
              onClick={() => setConfirmDiscard(true)}
            >
              <Trash2 aria-hidden />
              {t("discard")}
            </Button>
          ))}
      </div>
    </div>
  );
}
