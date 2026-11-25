"use client";

import { ClipboardPaste } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  filledFields,
  readProductText,
  type Autofill,
  type AutofillCategory,
  type AutofillField,
  type AutofillFineness,
} from "@/lib/merchant/autofill";

const MAX_TEXT = 4000;

/**
 * "Fill from text" above the new product form (#329): the seller pastes what she already has
 * (a catalog caption, an Instagram post, a WhatsApp message) and the form fields it names are
 * filled by plain rules in the browser. Nothing leaves the page and nothing is saved here; the
 * seller checks each step as usual. A field the text does not make clear is left as it was.
 */
export function AutofillText({
  categories,
  finenesses,
  onFill,
}: {
  categories: AutofillCategory[];
  finenesses: AutofillFineness[];
  onFill: (fill: Autofill) => void;
}) {
  const t = useTranslations("Merchant.form");
  const id = useId();
  const [text, setText] = useState("");
  const [result, setResult] = useState<AutofillField[] | null>(null);

  function fill() {
    const read = readProductText(text, { categories, finenesses });
    const fields = filledFields(read);
    setResult(fields);
    if (fields.length > 0) onFill(read);
  }

  return (
    <details className="group rounded-lg border bg-card p-4 sm:px-8">
      <summary className="flex cursor-pointer items-center gap-2 font-medium">
        <ClipboardPaste aria-hidden className="size-4 shrink-0 text-gold-text" />
        {t("autofill.title")}
      </summary>
      <div className="mt-4 flex flex-col gap-3">
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {t("autofill.hint")}
        </p>
        <Label htmlFor={`${id}-text`}>{t("autofill.label")}</Label>
        <textarea
          id={`${id}-text`}
          rows={5}
          maxLength={MAX_TEXT}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
          }}
          aria-describedby={`${id}-hint`}
          placeholder={t("autofill.placeholder")}
          className="rounded-lg border border-input bg-background px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
        />
        <div>
          <Button type="button" variant="outline" onClick={fill} disabled={!text.trim()}>
            {t("autofill.fill")}
          </Button>
        </div>
        <p aria-live="polite" className="text-sm">
          {result === null
            ? null
            : result.length > 0
              ? t("autofill.filled", {
                  fields: result.map((f) => t(`autofillFields.${f}`)).join(", "),
                })
              : t("autofill.nothing")}
        </p>
      </div>
    </details>
  );
}
