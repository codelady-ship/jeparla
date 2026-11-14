"use client";

import { LoaderCircle, LocateFixed, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { formatNear } from "@/lib/geo/near";

type Status = "idle" | "locating" | "denied" | "unavailable";

function storesHref(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `/stores?${s}` : "/stores";
}

/**
 * "Near me" (#116). The browser asks for the location only after this click; the
 * point goes into the URL rounded to about 1 km and is never saved. If the buyer
 * says no, the page keeps working with the city and name search.
 */
export function NearMeButton({ q, city, near }: { q?: string; city?: string; near?: string }) {
  const t = useTranslations("Stores");
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [pending, startTransition] = useTransition();

  function locate() {
    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setStatus("idle");
        const point = formatNear({ lat: coords.latitude, lng: coords.longitude });
        startTransition(() => router.push(storesHref({ q, city, near: point }), { scroll: false }));
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 600_000 },
    );
  }

  const busy = status === "locating" || pending;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={locate}
          disabled={busy}
          aria-describedby="near-me-note"
          className="h-10 pointer-coarse:h-11"
        >
          {busy ? (
            <LoaderCircle aria-hidden className="animate-spin" />
          ) : (
            <LocateFixed aria-hidden />
          )}
          {busy ? t("nearLocating") : t("nearMe")}
        </Button>
        {near && (
          <Link
            href={storesHref({ q, city })}
            scroll={false}
            className="inline-flex items-center gap-1 link-underline text-sm font-medium"
          >
            <X aria-hidden className="size-3.5" />
            {t("nearClear")}
          </Link>
        )}
      </div>
      <p id="near-me-note" className="text-sm text-muted-foreground" role="status">
        {status === "denied"
          ? t("nearDenied")
          : status === "unavailable"
            ? t("nearUnavailable")
            : near
              ? t("nearActive")
              : t("nearPrivacy")}
      </p>
    </div>
  );
}
