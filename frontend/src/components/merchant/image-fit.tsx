"use client";

import { Check, Loader2, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Outcome of one "fit to design" run, as the UI shows it. */
export type FitState =
  | { state: "working" }
  | { state: "done"; url: string; blob: Blob }
  | { state: "failed"; reason: "noItem" | "model" | "failed" };

/**
 * Runs the fit for one photo. The processing module (and with it ONNX Runtime and the model) is
 * imported only here, on the first click: no page loads it before.
 */
export async function runFit(file: Blob): Promise<FitState> {
  try {
    const fit = await import("@/lib/image-fit/fit");
    try {
      const { blob } = await fit.fitToDesign(file);
      return { state: "done", url: URL.createObjectURL(blob), blob };
    } catch (e) {
      if (e instanceof fit.NoItemError) return { state: "failed", reason: "noItem" };
      if (e instanceof fit.ModelError) return { state: "failed", reason: "model" };
      throw e;
    }
  } catch {
    return { state: "failed", reason: "failed" };
  }
}

/** Blob -> data: URL (the product form keeps photos as data URLs until it saves). */
export function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Before and after side by side, in the product card frame (4:5), with the choice: use the fitted
 * photo or keep the original. Nothing is replaced until the user picks.
 */
export function FitCompare({
  name,
  original,
  fit,
  onUse,
  onKeep,
  decided,
}: {
  name: string;
  original: string;
  fit: FitState;
  onUse: () => void;
  onKeep: () => void;
  /** Which version was picked, when the list keeps showing the pair. */
  decided?: "fitted" | "original";
}) {
  const t = useTranslations("Merchant.imageFit");
  const frame = "relative aspect-[4/5] overflow-hidden rounded-md border bg-muted";
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <figure className="flex flex-col gap-1">
          <div className={frame}>
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a site image */}
            <img
              src={original}
              alt={t("beforeAlt", { name })}
              className="size-full object-contain"
            />
          </div>
          <figcaption className="text-xs text-muted-foreground">{t("before")}</figcaption>
        </figure>
        <figure className="flex flex-col gap-1">
          <div className={frame}>
            {fit.state === "done" ? (
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a site image
              <img src={fit.url} alt={t("afterAlt", { name })} className="size-full object-cover" />
            ) : fit.state === "working" ? (
              <div className="flex size-full flex-col items-center justify-center gap-2 p-2 text-center text-xs text-muted-foreground">
                <Loader2 aria-hidden className="size-5 animate-spin" />
                {t("working")}
              </div>
            ) : (
              <p className="flex size-full items-center justify-center p-2 text-center text-xs text-destructive">
                {t(`errors.${fit.reason}`)}
              </p>
            )}
          </div>
          <figcaption className="text-xs text-muted-foreground">{t("after")}</figcaption>
        </figure>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={decided === "fitted" ? "secondary" : "gold"}
          size="sm"
          disabled={fit.state !== "done"}
          aria-pressed={decided ? decided === "fitted" : undefined}
          onClick={onUse}
        >
          <Check aria-hidden />
          {t("useFitted")}
        </Button>
        <Button
          type="button"
          variant={decided === "original" ? "secondary" : "outline"}
          size="sm"
          disabled={fit.state === "working"}
          aria-pressed={decided ? decided === "original" : undefined}
          onClick={onKeep}
        >
          <Undo2 aria-hidden />
          {t("keepOriginal")}
        </Button>
      </div>
    </div>
  );
}
