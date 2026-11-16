import { MapIcon, MapPin, ShieldCheck } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { StoreOpenStatus } from "@/components/pdp/store-open-status";
import { isVerified } from "@/components/product/product-card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { mapHref } from "@/lib/geo/map-link";
import type { StoreSummary } from "@/types/api";

/** Monogram stands in until stores upload logos (#30); no invented artwork. */
export function StoreMonogram({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={
        size === "lg"
          ? "inline-flex size-20 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-3xl text-primary-foreground"
          : "inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-xl text-primary-foreground"
      }
    >
      {name.trim().charAt(0)}
    </span>
  );
}

export function StoreCard({ store }: { store: StoreSummary }) {
  const t = useTranslations("Stores");
  const tp = useTranslations("Product");
  const tpd = useTranslations("Pdp");
  const format = useFormatter();
  // Only the seller's own point: a city name alone would open the wrong place.
  const map = mapHref(store.geo);
  return (
    <article className="relative flex h-full items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50">
      <StoreMonogram name={store.name} />
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="truncate font-sans text-base font-semibold">
          <Link
            href={`/stores/${store.slug}`}
            className="outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
          >
            {store.name}
          </Link>
        </h2>
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin aria-hidden className="size-3.5" />
          {store.city}
          {store.distanceKm !== undefined && (
            <span className="font-medium text-foreground">
              {" · "}
              {t("distance", {
                km: format.number(Number(store.distanceKm), { maximumFractionDigits: 1 }),
              })}
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {t("productCount", { count: store.productCount })}
          </span>
          {isVerified(store.verification) && (
            <Badge variant="gold">
              <ShieldCheck aria-hidden />
              {tp("verified")}
            </Badge>
          )}
        </div>
        {store.openingHours && (
          <StoreOpenStatus
            openingHours={store.openingHours}
            labels={{
              open: tpd("contact.open"),
              closedToday: tpd.raw("contact.closedToday") as string,
              closedTomorrow: tpd.raw("contact.closedTomorrow") as string,
              closedOn: tpd.raw("contact.closedOn") as string,
            }}
          />
        )}
        {map && (
          // Above the card's stretched link, so both stay clickable.
          <a
            href={map}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("openMapOf", { store: store.name })}
            className="touch-target relative z-10 flex items-center gap-1 self-start link-underline text-sm font-medium"
          >
            <MapIcon aria-hidden className="size-3.5 text-gold-text" />
            {t("openMap")}
          </a>
        )}
      </div>
    </article>
  );
}
