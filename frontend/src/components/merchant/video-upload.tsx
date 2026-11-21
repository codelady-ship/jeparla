"use client";

import { Clapperboard, Loader2, Sparkles, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isMessage } from "@/lib/api/problem";
import {
  clipLength,
  VIDEO_MAX_BYTES,
  VIDEO_MAX_SECONDS,
  VIDEO_TYPES,
  videoProblem,
  type MerchantVideo,
} from "@/lib/merchant/video";

/** Length of a local file in seconds, read by the browser; null when it cannot tell. */
function durationOf(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const probe = document.createElement("video");
    const done = (seconds: number | null) => {
      URL.revokeObjectURL(url);
      resolve(seconds);
    };
    probe.preload = "metadata";
    probe.onloadedmetadata = () => done(Number.isFinite(probe.duration) ? probe.duration : null);
    probe.onerror = () => done(null);
    setTimeout(() => done(null), 5000);
    probe.src = url;
  });
}

/**
 * The short video of a product (#117): optional, one clip of up to 15 seconds that shows the
 * shine a photo cannot. It is sent on its own (a clip does not fit the draft kept in the
 * browser), so the product must be saved first. The API checks the stored file again and, for
 * a listed product, sends it back to review.
 */
export function VideoUpload({
  productId,
  initial,
  listed,
}: {
  /** Null while the product has not been saved yet. */
  productId: number | null;
  initial: MerchantVideo | null;
  /** The product is live: a new video is reviewed before buyers see it. */
  listed: boolean;
}) {
  const t = useTranslations("Merchant.form.video");
  const id = useId();
  const [video, setVideo] = useState(initial);
  const [ai, setAi] = useState(false);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const max = VIDEO_MAX_BYTES / 1024 / 1024;
  const base = `/api/merchant/products/${productId}/video`;

  const failure = async (res: Response | null) => {
    if (!res) return t("errors.network");
    const data = (await res.json().catch(() => ({}))) as { errors?: { form?: string } };
    const form = data.errors?.form;
    if (form && isMessage(form)) return form;
    if (res.status === 401) return t("errors.sessionExpired");
    if (form === "videoType") return t("errors.badType");
    if (form === "videoSize" || res.status === 413) return t("errors.tooBig", { max });
    return t("errors.server");
  };

  async function pick(files: FileList | null) {
    const file = files?.[0];
    if (!file || productId === null) return;
    setProblem(null);
    setNotice(null);
    const why = videoProblem(file, await durationOf(file));
    if (why === "badType") return setProblem(t("badType", { name: file.name }));
    if (why === "tooBig") return setProblem(t("tooBig", { name: file.name, max }));
    if (why === "tooLong")
      return setProblem(t("tooLong", { name: file.name, seconds: VIDEO_MAX_SECONDS }));
    setBusy("upload");
    const res = await fetch(`${base}${ai ? "?ai=1" : ""}`, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    }).catch(() => null);
    if (res?.ok) {
      setVideo((await res.json()) as MerchantVideo);
      setNotice(listed ? t("savedReview") : t("saved"));
    } else {
      setProblem(await failure(res));
    }
    setBusy(null);
  }

  async function remove() {
    setProblem(null);
    setNotice(null);
    setBusy("remove");
    const res = await fetch(base, { method: "DELETE" }).catch(() => null);
    if (res?.ok) {
      setVideo(null);
      setNotice(t("removed"));
    } else {
      setProblem(await failure(res));
    }
    setBusy(null);
  }

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3
          id={`${id}-title`}
          className="flex items-center gap-2 font-sans text-base font-semibold"
        >
          <Clapperboard aria-hidden className="size-4 text-gold-text" />
          {t("title")}
          <span className="text-sm font-normal text-muted-foreground">({t("optional")})</span>
        </h3>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      {productId === null ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {t("saveFirst")}
        </p>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          {video && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              {/* The seller's own clip, in the cabinet: only its first frame loads until play. */}
              <video
                src={video.url}
                controls
                muted
                playsInline
                preload="metadata"
                aria-label={t("preview")}
                className="aspect-[4/5] w-full max-w-40 shrink-0 rounded-md bg-muted object-contain"
              />
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {t("length", { length: clipLength(video.durationMs) })}
                  </Badge>
                  {video.aiGenerated && (
                    <Badge variant="secondary">
                      <Sparkles aria-hidden />
                      {t("aiBadge")}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{t("shown")}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  className="self-start"
                  disabled={busy !== null}
                  onClick={() => void remove()}
                >
                  {busy === "remove" ? (
                    <Loader2 aria-hidden className="animate-spin" />
                  ) : (
                    <X aria-hidden />
                  )}
                  {t("remove")}
                </Button>
              </div>
            </div>
          )}

          <label htmlFor={`${id}-ai`} className="flex items-start gap-3 text-sm">
            <input
              id={`${id}-ai`}
              type="checkbox"
              checked={ai}
              onChange={(e) => setAi(e.target.checked)}
              disabled={busy !== null}
              className="mt-0.5 size-5 shrink-0 accent-primary"
            />
            <span>{t("aiLabel")}</span>
          </label>

          <label
            htmlFor={`${id}-file`}
            className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
          >
            {busy === "upload" ? (
              <Loader2 aria-hidden className="size-6 animate-spin text-gold-text" />
            ) : (
              <Upload aria-hidden className="size-6 text-gold-text" />
            )}
            <span className="font-medium">
              {busy === "upload" ? t("uploading") : video ? t("replace") : t("add")}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("rules", { max, seconds: VIDEO_MAX_SECONDS })}
            </span>
          </label>
          <input
            id={`${id}-file`}
            type="file"
            accept={VIDEO_TYPES.join(",")}
            className="sr-only"
            disabled={busy !== null}
            aria-label={t("pick")}
            onChange={(e) => {
              void pick(e.target.files);
              e.target.value = "";
            }}
          />
          <p className="text-xs text-muted-foreground">{t("tip")}</p>
        </div>
      )}
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
    </section>
  );
}
