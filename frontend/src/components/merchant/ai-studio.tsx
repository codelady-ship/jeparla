"use client";

import { Check, Loader2, RotateCcw, Sparkles, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isMessage } from "@/lib/api/problem";
import { sendJson } from "@/lib/merchant/client";
import { aiErrorCode, isRunning, quotaLeft } from "@/lib/merchant/ai";
import { notices } from "@/lib/notice";
import {
  AI_JOB_KINDS,
  kindAvailable,
  type AiJob,
  type AiJobKind,
  type AiModel,
  type AiStatus,
} from "@/types/ai";

export type AiSourceImage = { id: string; url: string };

const POLL_MS = 10_000;

const STATUS_VARIANT: Record<
  AiJob["status"],
  "default" | "gold" | "secondary" | "destructive" | "outline"
> = {
  QUEUED: "secondary",
  PROCESSING: "secondary",
  REVIEW_REQUIRED: "gold",
  APPROVED: "default",
  FAILED: "destructive",
  CANCELLED: "outline",
};

/**
 * AI Studio of one product (#55): choose an original photo and what to make, then
 * review the result. Nothing is published without "Approve"; an approved image
 * becomes an extra photo marked "AI ilə yaradılıb", the original stays first.
 * Without a provider the form is shown disabled with the reason, never with
 * sample results.
 */
export function AiStudio({
  productId,
  status,
  images,
  jobs: initialJobs,
  models = [],
  kinds = AI_JOB_KINDS,
}: {
  productId: number;
  status: AiStatus;
  images: AiSourceImage[];
  jobs: AiJob[];
  /** AI models of the library (#130), the default first. */
  models?: AiModel[];
  kinds?: readonly AiJobKind[];
}) {
  const t = useTranslations("Merchant.ai");
  const [source, setSource] = useState(images[0]?.id ?? "");
  const [kind, setKind] = useState<AiJobKind>(
    kinds.find((k) => kindAvailable(status, k)) ?? kinds[0] ?? "AI_PHOTOSHOOT",
  );
  const [modelId, setModelId] = useState<number | null>(models[0]?.id ?? null);
  const [jobs, setJobs] = useState(initialJobs);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Jobs and retries queued on this page count against today's quota too.
  const [queuedHere, setQueuedHere] = useState(0);
  const left = quotaLeft(status.dailyLimit, status.usedToday + queuedHere);
  const anyAvailable = kinds.some((k) => kindAvailable(status, k));
  const disabled = !kindAvailable(status, kind) || left === 0 || images.length === 0;
  const running = jobs.some((j) => isRunning(j.status));

  // While a job is queued or running, ask again every 10 s; the worker picks jobs
  // up every 15 s and the provider may take minutes. Stops when nothing runs.
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      void fetch(`/api/merchant/ai/jobs?productId=${productId}`)
        .then((r) => (r.ok ? (r.json() as Promise<AiJob[]>) : null))
        .then((fresh) => {
          if (fresh) setJobs(fresh);
        })
        .catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [running, productId]);

  /** A known AI code in the seller's words, the backend's own sentence, or a generic failure. */
  function message(code: string | undefined) {
    const known = aiErrorCode(code);
    if (known) return t(`errors.${known}`);
    return code && isMessage(code) ? code : t("errors.generic");
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (disabled || !source) return;
    setBusy("create");
    setError(null);
    const numeric = Number(source);
    const result = await sendJson<AiJob>("POST", "/api/merchant/ai/jobs", {
      productId,
      sourceImageId: Number.isInteger(numeric) && numeric > 0 ? numeric : source,
      kind,
      ...(kind === "VIRTUAL_TRY_ON" && modelId !== null ? { modelId } : {}),
    });
    setBusy(null);
    if (!result.ok) {
      setError(message(result.status === 429 ? "ai.quota" : result.errors.form));
      return;
    }
    setJobs((all) => [result.data, ...all]);
    setQueuedHere((n) => n + 1);
    notices.show(t("queued"));
  }

  async function act(
    job: AiJob,
    action: "approve" | "reject" | "retry" | "delete",
    assetId?: number,
  ) {
    setBusy(`${action}:${job.id}`);
    const result = await sendJson<AiJob>("POST", `/api/merchant/ai/jobs/${job.id}`, {
      action,
      ...(assetId === undefined ? {} : { assetId }),
    });
    setBusy(null);
    if (!result.ok) {
      notices.show(message(result.errors.form));
      return;
    }
    if (action === "delete") setJobs((all) => all.filter((j) => j.id !== job.id));
    else setJobs((all) => all.map((j) => (j.id === job.id ? result.data : j)));
    if (action === "retry") setQueuedHere((n) => n + 1);
    notices.show(t(`done.${action}`));
  }

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={(e) => void create(e)}
        className="flex flex-col gap-6"
        aria-describedby="ai-rules"
      >
        <fieldset className="flex flex-col gap-3" disabled={!anyAvailable}>
          <legend className="mb-2 font-semibold">{t("sourceLegend")}</legend>
          {images.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noImages")}</p>
          ) : (
            <div
              className="grid grid-cols-3 gap-3 sm:grid-cols-5"
              role="radiogroup"
              aria-label={t("sourceLegend")}
            >
              {images.map((img, i) => (
                <label
                  key={img.id}
                  className="flex cursor-pointer flex-col gap-1 rounded-lg border p-1.5 has-checked:border-gold has-checked:ring-2 has-checked:ring-gold/40 has-disabled:cursor-not-allowed has-disabled:opacity-60"
                >
                  <input
                    type="radio"
                    name="source"
                    value={img.id}
                    checked={source === img.id}
                    onChange={() => setSource(img.id)}
                    className="sr-only"
                  />
                  <span className="relative aspect-[4/5] overflow-hidden rounded-md bg-muted">
                    <Image
                      src={img.url}
                      alt={t("sourceAlt", { n: i + 1 })}
                      fill
                      sizes="(min-width: 640px) 20vw, 33vw"
                      className="object-cover"
                      unoptimized
                    />
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-3" disabled={!anyAvailable}>
          <legend className="mb-2 font-semibold">{t("kindLegend")}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {kinds.map((k) => (
              <label
                key={k}
                className="flex cursor-pointer gap-3 rounded-lg border p-4 has-checked:border-gold has-checked:ring-2 has-checked:ring-gold/40 has-disabled:cursor-not-allowed has-disabled:opacity-60"
              >
                <input
                  type="radio"
                  name="kind"
                  value={k}
                  checked={kind === k}
                  disabled={!kindAvailable(status, k)}
                  onChange={() => setKind(k)}
                  className="mt-1 accent-gold"
                />
                <span className="flex flex-col gap-1">
                  <span className="font-medium">{t(`kinds.${k}.title`)}</span>
                  <span className="text-sm text-muted-foreground">{t(`kinds.${k}.text`)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {kind === "VIRTUAL_TRY_ON" && (
          <fieldset className="flex flex-col gap-3" disabled={!status.configured}>
            <legend className="mb-2 font-semibold">{t("modelLegend")}</legend>
            {models.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("modelEmpty")}</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {models.map((model) => (
                  <label
                    key={model.id}
                    className="flex cursor-pointer flex-col gap-1 rounded-lg border p-1.5 has-checked:border-gold has-checked:ring-2 has-checked:ring-gold/40 has-disabled:cursor-not-allowed has-disabled:opacity-60"
                  >
                    <input
                      type="radio"
                      name="model"
                      value={model.id}
                      checked={modelId === model.id}
                      onChange={() => setModelId(model.id)}
                      className="sr-only"
                    />
                    <span className="relative aspect-[4/5] overflow-hidden rounded-md bg-muted">
                      {model.images[0] && (
                        <Image
                          src={model.images[0].url}
                          alt=""
                          fill
                          sizes="(min-width: 640px) 25vw, 50vw"
                          className="object-cover"
                          unoptimized
                        />
                      )}
                    </span>
                    <span className="px-1 text-sm font-medium">{model.name}</span>
                    <span className="px-1 text-xs text-muted-foreground">
                      {t(`modelStyle.${model.style}`)}
                      {model.isDefault ? ` · ${t("modelDefault")}` : ""}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" size="lg" disabled={disabled || busy !== null}>
            {busy === "create" ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : (
              <Sparkles aria-hidden />
            )}
            {t("create")}
          </Button>
          <p className="text-sm text-muted-foreground">
            {t("quota", { left, limit: status.dailyLimit })}
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>

      <section aria-labelledby="ai-jobs" className="flex flex-col gap-4">
        <h2 id="ai-jobs" className="text-xl">
          {t("jobsTitle")}
        </h2>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noJobs")}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {jobs.map((job) => (
              <li key={job.id} className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{t(`kinds.${job.kind}.title`)}</span>
                  <Badge variant={STATUS_VARIANT[job.status]}>
                    {isRunning(job.status) && <Loader2 aria-hidden className="animate-spin" />}
                    {t(`status.${job.status}`)}
                  </Badge>
                </div>
                {job.status === "FAILED" && (
                  <p className="text-sm text-muted-foreground">
                    {message(job.errorCode ?? undefined)}
                  </p>
                )}
                {job.status === "REVIEW_REQUIRED" && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {job.assets
                      .filter((a) => a.previewUrl)
                      .map((asset, i) => (
                        <div key={asset.id} className="flex flex-col gap-2">
                          <span className="relative aspect-[4/5] overflow-hidden rounded-md bg-muted">
                            <Image
                              src={asset.previewUrl ?? ""}
                              alt={t("resultAlt", { n: i + 1 })}
                              fill
                              sizes="(min-width: 640px) 25vw, 50vw"
                              className="object-cover"
                              unoptimized
                            />
                            {asset.aiGenerated && (
                              <span className="absolute top-1 left-1 rounded-sm bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
                                {t("aiBadge")}
                              </span>
                            )}
                          </span>
                          <Button
                            type="button"
                            size="lg"
                            disabled={busy !== null}
                            onClick={() => void act(job, "approve", asset.id)}
                          >
                            <Check aria-hidden />
                            {t("approve")}
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {job.status === "REVIEW_REQUIRED" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      disabled={busy !== null}
                      onClick={() => void act(job, "reject")}
                    >
                      <X aria-hidden />
                      {t("reject")}
                    </Button>
                  )}
                  {job.canRetry && (
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      disabled={busy !== null || left === 0}
                      onClick={() => void act(job, "retry")}
                    >
                      <RotateCcw aria-hidden />
                      {t("retry", { attempts: job.attempts, max: job.maxAttempts })}
                    </Button>
                  )}
                  {(job.status === "QUEUED" || job.status === "FAILED") && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      disabled={busy !== null}
                      onClick={() => void act(job, "delete")}
                    >
                      <Trash2 aria-hidden />
                      {t("delete")}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
