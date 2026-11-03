"use client";

import { useRouter } from "@/i18n/navigation";
import { useTransition, type FormEvent, type ReactNode } from "react";

/**
 * GET form for catalog filters. Without JavaScript it submits normally; with it, the
 * URL is updated in place (no full reload) and empty fields are left out.
 * `auto` submits on every change; the mobile sheet uses an explicit button instead.
 */
export function FilterForm({
  action,
  auto = false,
  className,
  children,
}: {
  /** Path without locale, e.g. "/products". */
  action: string;
  auto?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function navigate(form: HTMLFormElement) {
    const sp = new URLSearchParams();
    new FormData(form).forEach((value, key) => {
      if (typeof value === "string" && value.trim() !== "") sp.append(key, value.trim());
    });
    const q = sp.toString();
    startTransition(() => router.push(q ? `${action}?${q}` : action, { scroll: false }));
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    navigate(e.currentTarget);
  }

  return (
    <form
      action={action}
      method="get"
      onSubmit={onSubmit}
      onChange={auto ? (e) => navigate(e.currentTarget) : undefined}
      aria-busy={pending}
      className={className}
    >
      {children}
    </form>
  );
}
