"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { sendJson } from "@/lib/merchant/client";

/** Deletes one draft and its photo. */
export function DraftDeleteButton({ id, label }: { id: number; label: string }) {
  const t = useTranslations("Merchant.import");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function remove() {
    setPending(true);
    setFailed(false);
    const res = await sendJson("DELETE", `/api/merchant/drafts/${id}`, {});
    setPending(false);
    if (!res.ok) return setFailed(true);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        onClick={remove}
        disabled={pending}
        aria-label={t("deleteDraft", { name: label })}
        className="h-10"
      >
        {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Trash2 aria-hidden />}
        {t("delete")}
      </Button>
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {t("deleteFailed")}
        </p>
      )}
    </div>
  );
}
