import { Gift, Hammer, PenLine, Ruler, Truck, Undo2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Store, StoreServiceKind } from "@/types/api";

const SERVICE_ICONS: Record<StoreServiceKind, LucideIcon> = {
  RESIZE: Ruler,
  ENGRAVING: PenLine,
  GIFT_WRAP: Gift,
  DELIVERY: Truck,
  RETURNS: Undo2,
};

/** Whether the store has declared any terms (#108, #174). */
export function hasDeclaredTerms(store: Store): boolean {
  return (store.services ?? []).length > 0 || !!store.returnPolicy || !!store.madeToOrder;
}

/**
 * The terms a store declares itself (#108): its services and return terms (#174) and whether
 * it makes pieces to order. Kept apart from the measured facts and labelled as the store's own
 * statement: Jeparla does not check them. A part the store has not declared is left out.
 */
export async function StoreTerms({ store }: { store: Store }) {
  if (!hasDeclaredTerms(store)) return null;
  const [t, tp] = await Promise.all([
    getTranslations("Stores.terms"),
    getTranslations("Pdp.services"),
  ]);
  const services = store.services ?? [];
  const made = store.madeToOrder;

  return (
    <section aria-labelledby="store-terms" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="store-terms" className="text-xl">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>
      <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => {
          const Icon = SERVICE_ICONS[s];
          return (
            <li key={s} className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm">
              <Icon aria-hidden className="size-4 shrink-0 text-gold-text" />
              {tp(s)}
            </li>
          );
        })}
        {made && (
          <li className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm">
            <Hammer aria-hidden className="size-4 shrink-0 text-gold-text" />
            {!made.offered
              ? t("madeToOrderNo")
              : made.days !== null
                ? t("madeToOrderDays", { days: made.days })
                : t("madeToOrderYes")}
          </li>
        )}
      </ul>
      {store.returnPolicy && (
        <p className="max-w-2xl text-sm">
          <span className="font-medium">{tp("returnPolicy")}: </span>
          {store.returnPolicy}
        </p>
      )}
    </section>
  );
}
