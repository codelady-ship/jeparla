"use client";

import { Loader2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import { isMessage } from "@/lib/api/problem";
import type { Declaration, DocumentKind } from "@/lib/api/account";
import { sendJson } from "@/lib/merchant/client";
import { DOC_MAX_BYTES, DOC_TYPES } from "@/lib/seller/schemas";

const KINDS: { kind: DocumentKind; check: "DOCUMENTS" | "EXPERTISE" }[] = [
  { kind: "TAX_ID", check: "DOCUMENTS" },
  { kind: "TRADE_LICENSE", check: "DOCUMENTS" },
  { kind: "ASSAY_CERTIFICATE", check: "EXPERTISE" },
  { kind: "LAB_REPORT", check: "EXPERTISE" },
];

type Upload = { key: string; url: string; method: string; headers: Record<string, string> };

/**
 * One verification document (#40): the file goes straight from the browser to the private
 * bucket through a short-lived presigned URL (never through a public link), then the API
 * checks it and records it with the seller declaration the seller confirmed here.
 */
export function DocumentUpload({
  declaration,
  products,
}: {
  declaration: Declaration;
  products: { id: number; name: string }[];
}) {
  const t = useTranslations("Merchant.documents");
  const tm = useTranslations("Merchant");
  const router = useRouter();
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<DocumentKind>("TAX_ID");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const check = KINDS.find((k) => k.kind === kind)?.check ?? "DOCUMENTS";

  const text = (key: string) => {
    if (isMessage(key)) return key;
    if (t.has(`errors.${key}` as "errors.upload")) return t(`errors.${key}` as "errors.upload");
    if (tm.has(`errors.${key}` as "errors.server")) return tm(`errors.${key}` as "errors.server");
    return tm("errors.server");
  };

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSent(false);
    const form = new FormData(e.currentTarget);
    const file = form.get("file");
    const productId = Number(form.get("productId") ?? 0) || null;
    if (!(file instanceof File) || file.size === 0) return setError("fileRequired");
    if (!(DOC_TYPES as readonly string[]).includes(file.type)) return setError("fileType");
    if (file.size > DOC_MAX_BYTES) return setError("fileSize");
    if (check === "EXPERTISE" && !productId) return setError("productRequired");
    if (form.get("accept") !== "on") return setError("declaration");
    setError(null);
    setPending(true);
    try {
      const upload = await sendJson<Upload>("POST", "/api/merchant/documents/uploads", {
        checkKind: check,
        kind,
        productId: check === "EXPERTISE" ? productId : null,
        fileName: file.name.slice(0, 200),
        contentType: file.type,
        sizeBytes: file.size,
      });
      if (!upload.ok) return setError(upload.errors.form ?? "server");
      const put = await fetch(upload.data.url, {
        method: upload.data.method || "PUT",
        headers: upload.data.headers,
        body: file,
      }).catch(() => null);
      if (!put?.ok) return setError("upload");
      const confirmed = await sendJson("POST", "/api/merchant/documents", {
        key: upload.data.key,
        declarationAccepted: true,
        declarationVersion: declaration.version,
        declarationLanguage: declaration.language,
      });
      if (!confirmed.ok) return setError(confirmed.errors.form ?? "server");
      formRef.current?.reset();
      setKind("TAX_ID");
      setSent(true);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 p-3 text-sm text-destructive"
        >
          {text(error)}
        </p>
      )}
      {sent && (
        <p role="status" className="rounded-md border p-3 text-sm">
          {t("sent")}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-kind`}>{t("kindLabel")}</Label>
        <select
          id={`${id}-kind`}
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as DocumentKind)}
          className="h-11 rounded-md border border-input bg-background px-3 text-base"
        >
          {KINDS.map((k) => (
            <option key={k.kind} value={k.kind}>
              {t(`kind.${k.kind}`)}
            </option>
          ))}
        </select>
      </div>
      {check === "EXPERTISE" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-product`}>{t("productLabel")}</Label>
          <select
            id={`${id}-product`}
            name="productId"
            defaultValue=""
            className="h-11 rounded-md border border-input bg-background px-3 text-base"
          >
            <option value="">{t("productPick")}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-file`}>{t("fileLabel")}</Label>
        <input
          id={`${id}-file`}
          name="file"
          type="file"
          accept={DOC_TYPES.join(",")}
          className="text-sm file:mr-3 file:h-10 file:rounded-md file:border file:bg-background file:px-3 file:text-sm"
        />
      </div>
      <fieldset className="flex flex-col gap-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-semibold">{t("declarationTitle")}</legend>
        {declaration.draft && (
          <p className="text-xs text-muted-foreground">{t("declarationDraft")}</p>
        )}
        <div className="max-h-56 overflow-y-auto text-sm whitespace-pre-line" tabIndex={0}>
          {declaration.text}
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="accept" className="mt-1 size-4" />
          {t("accept")}
        </label>
      </fieldset>
      <Button type="submit" disabled={pending} className="h-11 self-start">
        {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Upload aria-hidden />}
        {pending ? t("sending") : t("submit")}
      </Button>
    </form>
  );
}
