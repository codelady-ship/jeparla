"use client";

import { Camera, ImagePlus, Loader2, Stamp, Tag, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downscale, EVIDENCE_MAX_SIDE, IMAGE_MAX_BYTES, IMAGE_TYPES } from "@/lib/merchant/images";
import {
  EVIDENCE_KINDS,
  type EvidenceInput,
  type EvidenceKind,
  type MaterialKind,
  type ProductInput,
} from "@/types/merchant";

type Evidence = NonNullable<ProductInput["evidence"]>;

const ICON = { HALLMARK: Stamp, TAG: Tag } as const;

/** What the seller sees about one photo: new (sent on save) or the admin check. */
function state(e: EvidenceInput): "NEW" | "PENDING" | "VERIFIED" | "REJECTED" {
  if (e.url.startsWith("data:")) return "NEW";
  return e.status === "VERIFIED" || e.status === "REJECTED" ? e.status : "PENDING";
}

const BADGE = {
  NEW: "outline",
  PENDING: "gold",
  VERIFIED: "secondary",
  REJECTED: "destructive",
} as const;

/** One slot: hallmark or label photo, with the phone tips and the check status. */
function Slot({
  kind,
  value,
  onChange,
}: {
  kind: EvidenceKind;
  value: EvidenceInput | undefined;
  onChange: (v: EvidenceInput | undefined) => void;
}) {
  const t = useTranslations("Merchant.form.evidence");
  const ti = useTranslations("Merchant.form.images");
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const Icon = ICON[kind];
  const max = IMAGE_MAX_BYTES / 1024 / 1024;

  async function pick(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setProblem(null);
    if (!(IMAGE_TYPES as readonly string[]).includes(f.type))
      return setProblem(ti("badType", { name: f.name }));
    if (f.size > IMAGE_MAX_BYTES) return setProblem(ti("tooBig", { name: f.name, max }));
    setBusy(true);
    try {
      onChange({ url: await downscale(f, EVIDENCE_MAX_SIDE) });
    } catch {
      setProblem(ti("failed", { name: f.name }));
    }
    setBusy(false);
  }

  const s = value ? state(value) : null;
  return (
    <fieldset className="flex min-w-0 flex-col gap-3 rounded-lg border p-4">
      <legend className="flex items-center gap-2 px-1 text-sm font-semibold">
        <Icon aria-hidden className="size-4 text-gold-text" />
        {t(`${kind}.title`)}
        <span className="font-normal text-muted-foreground">({t("optional")})</span>
      </legend>
      <p className="text-sm text-muted-foreground">{t(`${kind}.what`)}</p>
      <details className="rounded-md bg-muted px-3 py-2 text-sm">
        <summary className="flex cursor-pointer items-center gap-2 font-medium">
          <Camera aria-hidden className="size-4 text-gold-text" />
          {t("guide.title")}
        </summary>
        <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-muted-foreground">
          {(["macro", "light", "steady", "whole"] as const).map((step) => (
            <li key={step}>{t(`guide.${step}`)}</li>
          ))}
        </ol>
      </details>

      {value && s ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="relative aspect-square w-full max-w-40 shrink-0 overflow-hidden rounded-md bg-muted">
            <Image
              src={value.url}
              alt={t(`${kind}.alt`)}
              fill
              sizes="160px"
              className="object-cover"
              unoptimized
            />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <Badge variant={BADGE[s]} className="self-start">
              {t(`status.${s}`)}
            </Badge>
            <p className="text-sm text-muted-foreground">{t(`statusText.${s}`)}</p>
            {s === "REJECTED" && value.checkNote && (
              <p className="text-sm whitespace-pre-line text-destructive">
                {t("reason", { reason: value.checkNote })}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <label
                htmlFor={id}
                className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-muted has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
              >
                {busy ? (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                ) : (
                  <ImagePlus aria-hidden className="size-4" />
                )}
                {t("replace")}
              </label>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => onChange(undefined)}
                aria-label={t("removeNamed", { name: t(`${kind}.title`) })}
              >
                <X aria-hidden />
                {t("remove")}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
        >
          {busy ? (
            <Loader2 aria-hidden className="size-6 animate-spin text-gold-text" />
          ) : (
            <ImagePlus aria-hidden className="size-6 text-gold-text" />
          )}
          <span className="font-medium">{busy ? ti("processing") : t("add")}</span>
          <span className="text-xs text-muted-foreground">{t("rules", { max })}</span>
        </label>
      )}
      <input
        id={id}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        className="sr-only"
        disabled={busy}
        aria-label={t("pickNamed", { name: t(`${kind}.title`) })}
        onChange={(e) => {
          void pick(e.target.files);
          e.target.value = "";
        }}
      />
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
    </fieldset>
  );
}

/**
 * Hallmark and label photos (#106): optional, one of each, sent with the product and
 * compared by an admin with the fineness and weight. Bijouterie has no hallmark.
 * The note says plainly that a photo is not a laboratory assay.
 */
export function EvidenceUpload({
  value,
  materialKind,
  onChange,
}: {
  value: Evidence;
  materialKind: MaterialKind;
  onChange: (v: Evidence) => void;
}) {
  const t = useTranslations("Merchant.form.evidence");
  const kinds = EVIDENCE_KINDS.filter((k) => k !== "HALLMARK" || materialKind !== "FASHION");
  return (
    <section aria-labelledby="evidence-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 id="evidence-title" className="font-sans text-base font-semibold">
          {t("title")}
        </h3>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {kinds.map((kind) => (
          <Slot
            key={kind}
            kind={kind}
            value={value[kind]}
            onChange={(v) => {
              const next = { ...value };
              if (v) next[kind] = v;
              else delete next[kind];
              onChange(next);
            }}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t("notAssay")}</p>
    </section>
  );
}
