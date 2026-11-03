import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CLARITIES, COLORS, METALS, SHAPES } from "@/lib/catalog/filters";
import type { Category, Fineness, ProductFilters, StoreSummary } from "@/types/api";
import { StoreOptions } from "./store-options";

export type FilterData = {
  categories: Category[];
  stores: StoreSummary[];
  finenesses: Fineness[];
  cities: string[];
};

const input =
  "h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const box = "size-4 shrink-0 accent-primary";

function Group({
  legend,
  open = true,
  children,
}: {
  legend: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={open}
      className="group/f border-b py-4 [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="cursor-pointer list-none text-sm font-semibold after:float-right after:content-['+'] group-open/f:after:content-['−']">
        {legend}
      </summary>
      <fieldset className="mt-3 flex flex-col gap-1.5">
        <legend className="sr-only">{legend}</legend>
        {children}
      </fieldset>
    </details>
  );
}

function Check({
  id,
  name,
  value,
  checked,
  children,
  type = "checkbox",
}: {
  id: string;
  name: string;
  value: string;
  checked: boolean;
  children: ReactNode;
  type?: "checkbox" | "radio";
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <input
        id={id}
        type={type}
        name={name}
        value={value}
        defaultChecked={checked}
        className={box}
      />
      {children}
    </label>
  );
}

function Range({
  id,
  label,
  names,
  values,
  unit,
}: {
  id: string;
  label: { min: string; max: string };
  names: [string, string];
  values: [string | undefined, string | undefined];
  unit: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {names.map((name, i) => (
        <label key={name} htmlFor={`${id}-${name}`} className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">
            {i === 0 ? label.min : label.max} ({unit})
          </span>
          <input
            id={`${id}-${name}`}
            name={name}
            inputMode="decimal"
            pattern="\d+([.,]\d+)?"
            defaultValue={values[i]}
            className={input}
          />
        </label>
      ))}
    </div>
  );
}

/** All filter controls; rendered inside a FilterForm (desktop sidebar or mobile sheet). */
export function FilterFields({
  id,
  filters: f,
  data,
  hideCategory = false,
}: {
  /** Prefix for element ids, since the desktop and mobile forms can both be in the DOM. */
  id: string;
  filters: ProductFilters;
  data: FilterData;
  /** Category pages fix the category, so its filter is not shown. */
  hideCategory?: boolean;
}) {
  const t = useTranslations("Catalog");
  const tp = useTranslations("Product");
  const locale = useLocale();
  const roots = data.categories.filter((c) => c.parentId === null);
  const children = (pid: number) => data.categories.filter((c) => c.parentId === pid);
  const diamondActive = Boolean(f.shape || f.color || f.clarity || f.minCarat || f.maxCarat);
  const minMax = { min: t("min"), max: t("max") };

  return (
    <div className="flex flex-col">
      {/* Sort is kept when filters change. */}
      {f.sort && <input type="hidden" name="sort" value={f.sort} />}
      {f.q && <input type="hidden" name="q" value={f.q} />}

      {!hideCategory && (
        <Group legend={t("category")}>
          <Check id={`${id}-cat-all`} name="category" value="" checked={!f.category} type="radio">
            {t("allCategories")}
          </Check>
          {roots.map((c) => (
            <div key={c.id} className="flex flex-col gap-1.5">
              <Check
                id={`${id}-cat-${c.slug}`}
                name="category"
                value={c.slug}
                checked={f.category === c.slug}
                type="radio"
              >
                {c.name[locale]}
              </Check>
              {children(c.id).map((ch) => (
                <div key={ch.id} className="pl-6">
                  <Check
                    id={`${id}-cat-${ch.slug}`}
                    name="category"
                    value={ch.slug}
                    checked={f.category === ch.slug}
                    type="radio"
                  >
                    {ch.name[locale]}
                  </Check>
                </div>
              ))}
            </div>
          ))}
        </Group>
      )}

      <Group legend={t("store")}>
        <StoreOptions
          idPrefix={id}
          stores={data.stores.map(({ slug, name }) => ({ slug, name }))}
          selected={f.store ?? []}
          searchLabel={t("storeSearch")}
        />
      </Group>

      <Group legend={t("metal")}>
        <Check id={`${id}-metal-all`} name="metal" value="" checked={!f.metal} type="radio">
          {t("any")}
        </Check>
        {METALS.map((m) => (
          <Check
            key={m}
            id={`${id}-metal-${m}`}
            name="metal"
            value={m}
            checked={f.metal === m}
            type="radio"
          >
            {tp(`metal.${m}`)}
          </Check>
        ))}
      </Group>

      <Group legend={t("fineness")}>
        <div className="grid grid-cols-2 gap-1.5">
          {data.finenesses.map((fi) => (
            <Check
              key={fi.id}
              id={`${id}-fin-${fi.id}`}
              name="fineness"
              value={String(fi.value)}
              checked={f.fineness?.includes(fi.value) ?? false}
            >
              {fi.label}
            </Check>
          ))}
        </div>
      </Group>

      <Group legend={t("price")}>
        <Range
          id={`${id}-price`}
          label={minMax}
          names={["minPrice", "maxPrice"]}
          values={[f.minPrice, f.maxPrice]}
          unit="₼"
        />
      </Group>

      <Group legend={t("weight")}>
        <Range
          id={`${id}-weight`}
          label={minMax}
          names={["minWeight", "maxWeight"]}
          values={[f.minWeight, f.maxWeight]}
          unit={t("gramUnit")}
        />
      </Group>

      <Group legend={t("diamond")} open={diamondActive}>
        <p className="text-xs text-muted-foreground">{t("shape")}</p>
        <div className="grid grid-cols-2 gap-1.5">
          {SHAPES.map((s) => (
            <Check
              key={s}
              id={`${id}-shape-${s}`}
              name="shape"
              value={s}
              checked={f.shape?.includes(s) ?? false}
            >
              {t(`shapes.${s}`)}
            </Check>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("carat")}</p>
        <Range
          id={`${id}-carat`}
          label={minMax}
          names={["minCarat", "maxCarat"]}
          values={[f.minCarat, f.maxCarat]}
          unit={t("caratUnit")}
        />
        <p className="mt-2 text-xs text-muted-foreground">{t("color")}</p>
        <div className="grid grid-cols-4 gap-1.5">
          {COLORS.map((c) => (
            <Check
              key={c}
              id={`${id}-color-${c}`}
              name="color"
              value={c}
              checked={f.color?.includes(c) ?? false}
            >
              {c}
            </Check>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("clarity")}</p>
        <div className="grid grid-cols-3 gap-1.5">
          {CLARITIES.map((c) => (
            <Check
              key={c}
              id={`${id}-clarity-${c}`}
              name="clarity"
              value={c}
              checked={f.clarity?.includes(c) ?? false}
            >
              {c}
            </Check>
          ))}
        </div>
      </Group>

      <Group legend={t("more")}>
        <Check id={`${id}-verified`} name="verified" value="true" checked={f.verified ?? false}>
          {t("verifiedOnly")}
        </Check>
        <Check id={`${id}-instock`} name="inStock" value="true" checked={f.inStock ?? false}>
          {t("inStockOnly")}
        </Check>
        <label htmlFor={`${id}-city`} className="mt-2 flex flex-col gap-1 text-sm">
          {t("city")}
          <select id={`${id}-city`} name="city" defaultValue={f.city ?? ""} className={input}>
            <option value="">{t("anyCity")}</option>
            {data.cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </Group>

      <Button type="submit" className="mt-4">
        {t("apply")}
      </Button>
    </div>
  );
}
