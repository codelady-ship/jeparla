"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatSize,
  formatTenths,
  fromCircumference,
  fromDiameter,
  inTable,
  parseMm,
} from "@/lib/size-guide/ring-size";
import { cn } from "cn";

type Mode = "circumference" | "diameter";
const MODES: Mode[] = ["circumference", "diameter"];

/** Enter a circumference or a diameter in mm, see the nearest ring size (exact decimals). */
export function RingSizeHelper() {
  const t = useTranslations("SizeGuide.helper");
  const locale = useLocale();
  const id = useId();
  const [mode, setMode] = useState<Mode>("circumference");
  const [value, setValue] = useState("");

  const mm = value.trim() === "" ? undefined : parseMm(value);
  const m = mm ? (mode === "diameter" ? fromDiameter(mm) : fromCircumference(mm)) : undefined;
  const invalid = mm === null;

  return (
    <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()} noValidate>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{t("modeLegend")}</legend>
        <div className="flex flex-wrap gap-2">
          {MODES.map((x) => (
            <label
              key={x}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center rounded-md border px-3 text-sm has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                x === mode && "border-primary bg-primary text-primary-foreground",
              )}
            >
              <input
                type="radio"
                name={`${id}-mode`}
                value={x}
                checked={x === mode}
                onChange={() => setMode(x)}
                className="sr-only"
              />
              {t(x)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-mm`}>
          {mode === "diameter" ? t("inputDiameter") : t("inputCircumference")}
        </Label>
        <Input
          id={`${id}-mm`}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={`${id}-hint`}
          className="h-11 max-w-48 text-base tabular-nums md:text-base"
        />
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {t("hint")}
        </p>
      </div>

      <output htmlFor={`${id}-mm`} aria-live="polite" className="block min-h-20">
        {invalid ? (
          <span className="text-sm text-destructive">{t("invalid")}</span>
        ) : !m ? (
          <span className="text-sm text-muted-foreground">{t("empty")}</span>
        ) : !inTable(m.sizeHalves) ? (
          <span className="text-sm">{t("outOfRange")}</span>
        ) : (
          <span className="flex flex-col gap-1">
            <span className="font-heading text-3xl font-semibold tabular-nums">
              {t("result", { size: formatSize(m.sizeHalves, locale) })}
            </span>
            <span className="text-sm tabular-nums">
              {t("details", {
                diameter: formatTenths(m.diameterTenths, locale),
                circumference: formatTenths(m.circumferenceTenths, locale),
                iso: String(m.isoSize),
              })}
            </span>
            <span className="text-sm text-muted-foreground">{t("confirm")}</span>
          </span>
        )}
      </output>
    </form>
  );
}
