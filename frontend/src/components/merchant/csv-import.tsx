"use client";

import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { cn } from "cn";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Link, useRouter } from "@/i18n/navigation";
import { IMPORT_MAX_BYTES, type ImportResult } from "@/lib/merchant/bulk";
import { isMessage } from "@/lib/api/problem";
import { sendJson } from "@/lib/merchant/client";

/** The file as base64, read in chunks so a 1 MB workbook does not overflow the call stack. */
async function base64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/**
 * CSV and Excel (.xlsx) import (#109): one DRAFT product per row. The file is read in the browser and sent
 * to the cabinet route handler; a new Idempotency-Key is made only when a new file is chosen,
 * so pressing the button twice creates nothing twice. Bad rows are listed with line and column.
 */
export function CsvImport() {
  const t = useTranslations("Merchant.import");
  const tm = useTranslations("Merchant");
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const text = (k: string) => {
    if (isMessage(k)) return k;
    if (t.has(`errors.${k}` as "errors.fileRequired"))
      return t(`errors.${k}` as "errors.fileRequired");
    if (tm.has(`errors.${k}` as "errors.server")) return tm(`errors.${k}` as "errors.server");
    return tm("errors.server");
  };

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return setError("fileRequired");
    const excel = /\.xlsx$/i.test(file.name);
    if (!excel && !/\.(csv|txt)$/i.test(file.name)) return setError("csvType");
    if (file.size > IMPORT_MAX_BYTES) return setError("csvSize");
    setError(null);
    setResult(null);
    setPending(true);
    try {
      const sent = await sendJson<ImportResult>("POST", "/api/merchant/products/import", {
        ...(excel ? { xlsx: await base64(file) } : { csv: await file.text() }),
        notPreciousConfirmed: form.get("notPrecious") === "on",
        idempotencyKey: key ?? crypto.randomUUID(),
      });
      if (!sent.ok) return setError(sent.errors.form ?? "server");
      setResult(sent.data);
      if (sent.data.created.length > 0) router.refresh();
    } finally {
      setPending(false);
    }
  }

  const created = result?.created.filter((r) => r.created).length ?? 0;
  const repeated = (result?.created.length ?? 0) - created;

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-muted-foreground">
        <li>{t("csvStep1")}</li>
        <li>{t("csvStep2")}</li>
        <li>{t("csvStep3")}</li>
      </ol>
      <div className="flex flex-wrap gap-2">
        {(["az", "en", "ru"] as const).map((lang) => (
          <a
            key={lang}
            href={`/api/merchant/products/import/template?lang=${lang}`}
            download
            className={cn(
              buttonVariants({ variant: lang === locale ? "default" : "outline" }),
              "h-10 px-3",
            )}
          >
            <Download aria-hidden />
            {t("template", { lang: lang.toUpperCase() })}
          </a>
        ))}
        {(["az", "en", "ru"] as const).map((lang) => (
          <a
            key={`xlsx-${lang}`}
            href={`/api/merchant/products/import/template?lang=${lang}&format=xlsx`}
            download
            className={cn(buttonVariants({ variant: "outline" }), "h-10 px-3")}
          >
            <FileSpreadsheet aria-hidden />
            {t("xlsxTemplate", { lang: lang.toUpperCase() })}
          </a>
        ))}
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 p-3 text-sm text-destructive"
        >
          {text(error)}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-file`}>{t("csvLabel")}</Label>
        <input
          id={`${id}-file`}
          name="file"
          type="file"
          accept=".csv,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={() => {
            setKey(crypto.randomUUID());
            setResult(null);
          }}
          className="text-sm file:mr-3 file:h-10 file:rounded-md file:border file:bg-background file:px-3 file:text-sm"
        />
        <p className="text-xs text-muted-foreground">{t("csvHint")}</p>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="notPrecious" className="mt-1 size-4" />
        <span>{t("notPrecious")}</span>
      </label>
      <Button type="submit" disabled={pending} className="h-11 self-start">
        {pending ? (
          <Loader2 aria-hidden className="animate-spin" />
        ) : (
          <FileSpreadsheet aria-hidden />
        )}
        {pending ? t("importing") : t("importSubmit")}
      </Button>

      {result && (
        <div role="status" className="flex flex-col gap-3 rounded-lg border p-4 text-sm">
          <p className="font-medium">
            {t("importDone", { rows: result.rows, created, failed: result.errors.length })}
          </p>
          {repeated > 0 && (
            <p className="text-muted-foreground">{t("importRepeated", { count: repeated })}</p>
          )}
          {created > 0 && (
            <Link href="/merchant/products" className="self-start link-underline font-medium">
              {t("toProducts")}
            </Link>
          )}
          {result.errors.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="mb-2 text-left font-medium">{t("errorsTitle")}</caption>
                <thead className="text-muted-foreground">
                  <tr>
                    <th scope="col" className="py-1 pr-3 font-medium">
                      {t("line")}
                    </th>
                    <th scope="col" className="py-1 pr-3 font-medium">
                      {t("column")}
                    </th>
                    <th scope="col" className="py-1 font-medium">
                      {t("problem")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.errors.map((r, i) => (
                    <tr key={`${r.line}-${r.column}-${i}`} className="border-t align-top">
                      <td className="py-1 pr-3 tabular-nums">{r.line}</td>
                      <td className="py-1 pr-3">{r.column ?? "-"}</td>
                      <td className="py-1">{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
