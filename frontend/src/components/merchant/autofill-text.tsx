"use client";

import { ChevronDown, ClipboardPaste } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  readProductText,
  type Autofill,
  type AutofillCategory,
  type AutofillField,
  type AutofillFineness,
} from "@/lib/merchant/autofill";

const MAX_TEXT = 4000;

/** What the form did with a reading: fields it filled, and fields kept because the seller had typed them. */
export type AutofillOutcome = { filled: AutofillField[]; kept: AutofillField[] };

/**
 * "Fill from text" above the new product form (#329): the seller pastes what she already has
 * (a catalog caption, an Instagram post, a WhatsApp message) and the empty form fields it names
 * are filled by plain rules in the browser. Nothing leaves the page and nothing is saved here;
 * what the seller already typed is never replaced, and she checks each step as usual.
 */
export function AutofillText({
  categories,
  finenesses,
  onFill,
}: {
  categories: AutofillCategory[];
  finenesses: AutofillFineness[];
  onFill: (fill: Autofill) => AutofillOutcome;
}) {
  const t = useTranslations("Merchant.form");
  const id = useId();
  const [text, setText] = useState("");
  const [result, setResult] = useState<AutofillOutcome | null>(null);

  function fill() {
    const outcome = onFill(readProductText(text, { categories, finenesses }));
    // Empty the live region first, so pressing again with the same text is announced again.
    setResult(null);
    setTimeout(() => setResult(outcome), 100);
  }

  const names = (fields: AutofillField[]) => fields.map((f) => t(`autofillFields.${f}`)).join(", ");

  return (
    <details className="group rounded-lg border bg-card p-4 sm:px-8">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium [&::-webkit-details-marker]:hidden">
        <ClipboardPaste aria-hidden className="size-4 shrink-0 text-gold-text" />
        {t("autofill.title")}
        <ChevronDown
          aria-hidden
          className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
        />
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
        <div aria-live="polite" className="flex flex-col gap-1 text-sm">
          {result &&
            (result.filled.length === 0 && result.kept.length === 0 ? (
              <p>{t("autofill.nothing")}</p>
            ) : (
              <>
                {result.filled.length > 0 && (
                  <p>{t("autofill.filled", { fields: names(result.filled) })}</p>
                )}
                {result.kept.length > 0 && (
                  <p className="text-muted-foreground">
                    {t("autofill.kept", { fields: names(result.kept) })}
                  </p>
                )}
              </>
            ))}
        </div>
      </div>
    </details>
  );
}
