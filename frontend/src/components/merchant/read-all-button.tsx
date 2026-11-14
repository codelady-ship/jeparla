"use client";

import { CheckCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { sendJson } from "@/lib/merchant/client";

/** Marks every notification read, then reloads the list and the unread count. */
export function ReadAllButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await sendJson("POST", "/api/notifications/read-all", {});
        setPending(false);
        router.refresh();
      }}
    >
      <CheckCheck aria-hidden />
      {label}
    </Button>
  );
}
