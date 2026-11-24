"use client";

import { Download, ImagePlus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FitCompare, runFit, type FitState } from "@/components/merchant/image-fit";
import { IMAGE_MAX_BYTES, IMAGE_TYPES } from "@/lib/merchant/images";

const MAX_AT_ONCE = 24;

type Item = {
  key: number;
  file: File;
  original: string;
  fit: FitState;
  decided: "fitted" | "original" | null;
};

/** File name of the download: the original name with "-fit.webp" (or the original file). */
export function fittedName(name: string, type: string) {
  const base = name.replace(/\.[^.]+$/, "") || "photo";
  return `${base}-fit.${type === "image/webp" ? "webp" : "jpg"}`;
}

/**
 * The admin's photo bench (demo catalog and support): pick product photos, each is fitted to the
 * design on this device, the admin compares before and after and keeps the fitted file or the
 * original, then downloads it. Nothing is uploaded from here.
 */
export function PhotoFitList() {
  const t = useTranslations("Admin.photos");
  const [items, setItems] = useState<Item[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  /** Key of the photo being fitted now; the others with state "working" are only queued. */
  const [processing, setProcessing] = useState<number | null>(null);
  const nextKey = useRef(1);
  const running = useRef(false);
  const unmounted = useRef(false);
  const live = useRef(items);
  useEffect(() => {
    live.current = items;
  }, [items]);

  // The queue stops when the page is left; object URLs live as long as the page.
  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      for (const it of live.current) {
        URL.revokeObjectURL(it.original);
        if (it.fit.state === "done") URL.revokeObjectURL(it.fit.url);
      }
    };
  }, []);

  /** Fits waiting photos one at a time (the model runs on the main device CPU). */
  async function drain() {
    if (running.current) return;
    running.current = true;
    while (!unmounted.current) {
      const next = live.current.find((i) => i.fit.state === "working");
      if (!next) break;
      setProcessing(next.key);
      const fit = await runFit(next.file);
      if (unmounted.current || !live.current.some((i) => i.key === next.key)) {
        if (fit.state === "done") URL.revokeObjectURL(fit.url);
        continue;
      }
      setItems((list) => list.map((i) => (i.key === next.key ? { ...i, fit } : i)));
      live.current = live.current.map((i) => (i.key === next.key ? { ...i, fit } : i));
    }
    running.current = false;
    if (!unmounted.current) setProcessing(null);
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const picked = [...(input.files ?? [])];
    input.value = "";
    const rejected: string[] = [];
    const added: Item[] = [];
    for (const file of picked) {
      if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
        rejected.push(t("badType", { name: file.name }));
      } else if (file.size > IMAGE_MAX_BYTES) {
        rejected.push(t("tooBig", { name: file.name, max: IMAGE_MAX_BYTES / 1024 / 1024 }));
      } else if (live.current.length + added.length >= MAX_AT_ONCE) {
        rejected.push(t("tooMany", { max: MAX_AT_ONCE }));
        break;
      } else {
        added.push({
          key: nextKey.current++,
          file,
          original: URL.createObjectURL(file),
          fit: { state: "working" },
          decided: null,
        });
      }
    }
    setErrors(rejected);
    live.current = [...live.current, ...added];
    setItems(live.current);
    void drain();
  }

  const decide = (key: number, decided: Item["decided"]) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, decided } : i)));

  function remove(item: Item) {
    URL.revokeObjectURL(item.original);
    if (item.fit.state === "done") URL.revokeObjectURL(item.fit.url);
    // Also out of the queue: a queued photo is then never fitted.
    live.current = live.current.filter((i) => i.key !== item.key);
    setItems(live.current);
  }

  const pick =
    "flex h-11 w-fit cursor-pointer items-center justify-center gap-2 rounded-lg border bg-background px-4 text-sm font-medium outline-none hover:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50";

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
        {(["local", "frame", "honesty", "licence"] as const).map((k) => (
          <li key={k}>{t(`rules.${k}`)}</li>
        ))}
      </ul>
      <Label className={pick}>
        <ImagePlus aria-hidden className="size-4 text-gold-text" />
        {t("choose")}
        <input
          type="file"
          multiple
          accept={IMAGE_TYPES.join(",")}
          onChange={onPick}
          className="sr-only"
        />
      </Label>
      {errors.length > 0 && (
        <ul
          role="alert"
          className="flex flex-col gap-1 rounded-md border border-destructive/40 p-3 text-sm text-destructive"
        >
          {errors.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul aria-label={t("list")} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const chosen =
              item.decided === "fitted" && item.fit.state === "done"
                ? { href: item.fit.url, name: fittedName(item.file.name, item.fit.blob.type) }
                : item.decided === "original"
                  ? { href: item.original, name: item.file.name }
                  : null;
            return (
              <li key={item.key} className="flex flex-col gap-3 rounded-lg border p-3">
                <p className="truncate text-sm font-medium" title={item.file.name}>
                  {item.file.name}
                </p>
                <FitCompare
                  name={item.file.name}
                  original={item.original}
                  fit={item.fit}
                  decided={item.decided ?? undefined}
                  onUse={() => decide(item.key, "fitted")}
                  onKeep={() => decide(item.key, "original")}
                />
                <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                  {chosen ? (
                    <a
                      href={chosen.href}
                      download={chosen.name}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <Download aria-hidden />
                      {t("download", { name: chosen.name })}
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t("pickFirst")}</p>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    disabled={item.key === processing}
                    aria-label={t("remove", { name: item.file.name })}
                    onClick={() => remove(item)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
