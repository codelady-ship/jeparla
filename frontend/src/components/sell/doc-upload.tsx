"use client";

import { FileText, Upload, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type DragEvent } from "react";
import { formatDecimal } from "@/lib/money";
import { DOC_MAX_BYTES, DOC_MAX_COUNT, DOC_TYPES, type DocMeta } from "@/lib/seller/schemas";
import { cn } from "cn";

/**
 * Drag and drop or pick files (phone camera works through the picker). Only
 * name, size and type are kept in the draft; uploading to private storage comes
 * with the backend (PLAN 5.9).
 */
export function DocUpload({
  docs,
  onChange,
}: {
  docs: DocMeta[];
  onChange: (docs: DocMeta[]) => void;
}) {
  const t = useTranslations("Sell.docs");
  const locale = useLocale();
  const id = useId();
  const [over, setOver] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);

  function add(files: FileList | null) {
    if (!files) return;
    const next = [...docs];
    const problems: string[] = [];
    for (const f of Array.from(files)) {
      if (!(DOC_TYPES as readonly string[]).includes(f.type)) {
        problems.push(t("badType", { name: f.name }));
      } else if (f.size > DOC_MAX_BYTES) {
        problems.push(t("tooBig", { name: f.name, max: DOC_MAX_BYTES / 1024 / 1024 }));
      } else if (next.length >= DOC_MAX_COUNT) {
        problems.push(t("tooMany", { max: DOC_MAX_COUNT }));
        break;
      } else if (!next.some((d) => d.name === f.name && d.size === f.size)) {
        next.push({
          id: `${Date.now().toString(36)}-${next.length}`,
          name: f.name.slice(0, 200),
          size: f.size,
          type: f.type as DocMeta["type"],
        });
      }
    }
    setRejected(problems);
    onChange(next);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    add(e.dataTransfer.files);
  }

  const size = (bytes: number) =>
    bytes >= 1024 * 1024
      ? `${formatDecimal((bytes / 1024 / 1024).toFixed(1), locale, { max: 1 })} MB`
      : `${formatDecimal(String(Math.max(1, Math.round(bytes / 1024))), locale)} KB`;

  return (
    <div className="flex flex-col gap-3">
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center text-sm has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
          over ? "border-primary bg-muted" : "border-border",
        )}
      >
        <Upload aria-hidden className="size-6 text-gold-text" />
        <span className="font-medium">{t("drop")}</span>
        <span className="text-xs text-muted-foreground">
          {t("rules", { max: DOC_MAX_BYTES / 1024 / 1024, count: DOC_MAX_COUNT })}
        </span>
        <input
          id={id}
          type="file"
          multiple
          accept={DOC_TYPES.join(",")}
          className="sr-only"
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      <div aria-live="polite">
        {rejected.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm text-destructive">
            {rejected.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </div>

      {docs.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label={t("list")}>
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
              <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{d.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {size(d.size)}
              </span>
              <button
                type="button"
                onClick={() => onChange(docs.filter((x) => x.id !== d.id))}
                aria-label={t("remove", { name: d.name })}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
