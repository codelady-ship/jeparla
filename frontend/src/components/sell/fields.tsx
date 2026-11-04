"use client";

import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "cn";

type Base = { id: string; label: string; error?: string; hint?: string; optional?: string };

function describedBy(id: string, error?: string, hint?: string) {
  return [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;
}

function Messages({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  return (
    <>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </>
  );
}

function FieldLabel({ id, label, optional }: { id: string; label: string; optional?: string }) {
  return (
    <Label htmlFor={id}>
      {label}
      {optional && <span className="font-normal text-muted-foreground">({optional})</span>}
    </Label>
  );
}

export function TextField({
  id,
  label,
  error,
  hint,
  optional,
  className,
  ...input
}: Base & Omit<ComponentProps<"input">, "id">) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <FieldLabel id={id} label={label} optional={optional} />
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className="h-11"
        {...input}
      />
      <Messages id={id} error={error} hint={hint} />
    </div>
  );
}

export function SelectField({
  id,
  label,
  error,
  hint,
  optional,
  placeholder,
  options,
  className,
  ...select
}: Base & {
  placeholder: string;
  options: { value: string; label: string }[];
} & Omit<ComponentProps<"select">, "id">) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <FieldLabel id={id} label={label} optional={optional} />
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className="h-11 rounded-lg border border-input bg-background px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm"
        {...select}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Messages id={id} error={error} hint={hint} />
    </div>
  );
}

export function RadioGroupField({
  id,
  label,
  error,
  value,
  onChange,
  options,
}: Base & {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; hint?: ReactNode }[];
}) {
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
              value === o.value && "border-primary bg-muted",
            )}
          >
            <span className="flex items-center gap-2 font-medium">
              <input
                type="radio"
                name={id}
                value={o.value}
                checked={value === o.value}
                onChange={() => onChange(o.value)}
                className="size-4 accent-primary"
              />
              {o.label}
            </span>
            {o.hint && <span className="text-xs text-muted-foreground">{o.hint}</span>}
          </label>
        ))}
      </div>
      <Messages id={id} error={error} />
    </fieldset>
  );
}
