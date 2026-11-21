"use client";

import { ArrowDown, ArrowLeftRight, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { errorKey } from "@/lib/admin/errors";
import {
  categorySchema,
  collectionSchema,
  finenessSchema,
  synonymSchema,
} from "@/lib/admin/settings";
import { sendJson } from "@/lib/merchant/client";
import { notices } from "@/lib/notice";
import type { AdminCategory, AdminCollection, AdminFineness, SynonymPair } from "@/types/admin";
import type { LocalizedText, MetalType } from "@/types/api";
import { AdminDialog, Field, fieldClass, useAdminForm } from "./admin-dialog";

const METALS: MetalType[] = ["GOLD", "SILVER", "PLATINUM", "PALLADIUM"];
const LANGS = ["az", "en", "ru"] as const;

/**
 * Catalog settings (PLAN 5.8): categories, finenesses (əyar) and search
 * synonyms. Items in use can't be deleted; the server answers 409 inUse.
 */
export function CatalogSettings({
  categories,
  collections,
  finenesses,
  synonyms,
}: {
  categories: AdminCategory[];
  /** Occasion collections (#115), hidden ones too, in order. */
  collections: AdminCollection[];
  finenesses: AdminFineness[];
  synonyms: SynonymPair[];
}) {
  return (
    <div className="flex flex-col gap-10">
      <Categories initial={categories} />
      <Collections initial={collections} />
      <Finenesses initial={finenesses} />
      <Synonyms initial={synonyms} />
    </div>
  );
}

function Section({
  id,
  title,
  intro,
  action,
  children,
}: {
  id: string;
  title: string;
  intro: string;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 id={id} className="text-2xl">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{intro}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" size="lg" onClick={onClick}>
      <Plus aria-hidden />
      {label}
    </Button>
  );
}

/** Delete with a confirm dialog; the server refuses items still in use. */
function DeleteButton({
  endpoint,
  name,
  onDone,
}: {
  endpoint: string;
  name: string;
  onDone: () => void;
}) {
  const t = useTranslations("Admin");
  const [open, setOpen] = useState(false);
  const form = useAdminForm();
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="lg"
        aria-label={t("actions.named", { action: t("catalog.delete"), name })}
        onClick={() => {
          form.setErrors({});
          setOpen(true);
        }}
      >
        <Trash2 aria-hidden />
        <span className="sr-only sm:not-sr-only">{t("catalog.delete")}</span>
      </Button>
      <AdminDialog
        open={open}
        onOpenChange={setOpen}
        title={t("catalog.deleteTitle", { name })}
        description={t("catalog.deleteText")}
        submitLabel={t("catalog.delete")}
        destructive
        busy={form.busy}
        formError={form.errors.form}
        onSubmit={async () => {
          const done = await form.submit("DELETE", endpoint, z.unknown(), {});
          if (!done) return;
          setOpen(false);
          onDone();
          notices.show(t("catalog.deleted", { name }));
        }}
      />
    </>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed px-4 py-8 text-center text-muted-foreground">
      {text}
    </p>
  );
}

// ---------------------------------------------------------------- categories

const EMPTY_NAME: LocalizedText = { az: "", en: "", ru: "" };

function Categories({ initial }: { initial: AdminCategory[] }) {
  const t = useTranslations("Admin");
  const locale = useLocale() as keyof LocalizedText;
  const [rows, setRows] = useState(initial);
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [parentId, setParentId] = useState("");
  const [name, setName] = useState(EMPTY_NAME);
  const form = useAdminForm();
  const roots = rows.filter((c) => c.parentId === null);
  const parentName = (id: number | null) => rows.find((c) => c.id === id)?.name[locale] ?? "";

  async function add() {
    const created = await form.submit<AdminCategory, typeof categorySchema>(
      "POST",
      "/api/admin/categories",
      categorySchema,
      { slug, parentId: parentId ? Number(parentId) : null, name },
    );
    if (!created) return;
    setRows((all) => [...all, created]);
    setOpen(false);
    notices.show(t("catalog.added", { name: created.name[locale] }));
  }

  return (
    <Section
      id="categories"
      title={t("catalog.categories")}
      intro={t("catalog.categoriesIntro")}
      action={
        <AddButton
          label={t("catalog.addCategory")}
          onClick={() => {
            setSlug("");
            setParentId("");
            setName(EMPTY_NAME);
            form.setErrors({});
            setOpen(true);
          }}
        />
      }
    >
      {rows.length === 0 ? (
        <Empty text={t("catalog.noCategories")} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3 rounded-lg border p-4">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="font-medium break-words">{c.name[locale]}</p>
                <p className="text-xs break-words text-muted-foreground">
                  {LANGS.filter((l) => l !== locale)
                    .map((l) => c.name[l])
                    .join(" · ")}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">{c.slug}</span>
                  {c.parentId !== null && ` · ${t("catalog.in", { name: parentName(c.parentId) })}`}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {t("stores.products", { count: c.productCount })}
                </p>
              </div>
              <DeleteButton
                endpoint={`/api/admin/categories/${c.id}`}
                name={c.name[locale]}
                onDone={() => setRows((all) => all.filter((r) => r.id !== c.id))}
              />
            </li>
          ))}
        </ul>
      )}
      <AdminDialog
        open={open}
        onOpenChange={setOpen}
        title={t("catalog.addCategory")}
        description={t("catalog.categoryText")}
        submitLabel={t("catalog.save")}
        busy={form.busy}
        formError={form.errors.form}
        onSubmit={() => void add()}
      >
        {LANGS.map((l) => (
          <Field key={l} label={t(`catalog.name.${l}`)} error={form.errors[`name.${l}`]}>
            {(props) => (
              <input
                {...props}
                lang={l}
                value={name[l]}
                maxLength={60}
                onChange={(e) => setName((n) => ({ ...n, [l]: e.target.value }))}
                className={fieldClass}
              />
            )}
          </Field>
        ))}
        <Field label={t("catalog.slug")} error={form.errors.slug} hint={t("catalog.slugHint")}>
          {(props) => (
            <input
              {...props}
              value={slug}
              maxLength={40}
              autoCapitalize="none"
              spellCheck={false}
              onChange={(e) => setSlug(e.target.value)}
              className={fieldClass}
            />
          )}
        </Field>
        <Field label={t("catalog.parent")} error={form.errors.parentId}>
          {(props) => (
            <select
              {...props}
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className={fieldClass}
            >
              <option value="">{t("catalog.noParent")}</option>
              {roots.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name[locale]}
                </option>
              ))}
            </select>
          )}
        </Field>
      </AdminDialog>
    </Section>
  );
}

// ---------------------------------------------------------------- occasion collections (#115)

type CollectionDraft = { id: number | null; slug: string; name: LocalizedText; active: boolean };

function Collections({ initial }: { initial: AdminCollection[] }) {
  const t = useTranslations("Admin");
  const locale = useLocale() as keyof LocalizedText;
  const [rows, setRows] = useState(initial);
  const [draft, setDraft] = useState<CollectionDraft | null>(null);
  const [moving, setMoving] = useState(false);
  const form = useAdminForm();

  function open(c: AdminCollection | null) {
    form.setErrors({});
    setDraft(
      c
        ? { id: c.id, slug: c.slug, name: c.name, active: c.active }
        : { id: null, slug: "", name: EMPTY_NAME, active: true },
    );
  }

  async function save() {
    if (!draft) return;
    const body = { slug: draft.slug, name: draft.name, active: draft.active };
    const saved = await form.submit<AdminCollection, typeof collectionSchema>(
      draft.id === null ? "POST" : "PUT",
      draft.id === null ? "/api/admin/collections" : `/api/admin/collections/${draft.id}`,
      collectionSchema,
      body,
    );
    if (!saved) return;
    setRows((all) =>
      draft.id === null ? [...all, saved] : all.map((r) => (r.id === saved.id ? saved : r)),
    );
    setDraft(null);
    notices.show(
      t(draft.id === null ? "catalog.added" : "catalog.saved", { name: saved.name[locale] }),
    );
  }

  /** Moves one collection up or down and saves the whole order at once. */
  async function move(index: number, by: -1 | 1) {
    const next = [...rows];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    setMoving(true);
    const result = await sendJson<AdminCollection[]>("PUT", "/api/admin/collections/order", {
      ids: next.map((r) => r.id),
    });
    setMoving(false);
    if (!result.ok) {
      notices.show(t(`errors.${errorKey(result.errors.form ?? "server")}`));
      return;
    }
    setRows(result.data);
    notices.show(t("catalog.moved", { name: item.name[locale] }));
  }

  return (
    <Section
      id="collections"
      title={t("catalog.collections")}
      intro={t("catalog.collectionsIntro")}
      action={<AddButton label={t("catalog.addCollection")} onClick={() => open(null)} />}
    >
      {rows.length === 0 ? (
        <Empty text={t("catalog.noCollections")} />
      ) : (
        <ol className="flex flex-col gap-3" aria-busy={moving || undefined}>
          {rows.map((c, i) => (
            <li
              key={c.id}
              className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <p className="flex flex-wrap items-center gap-2 font-medium break-words">
                  {c.name[locale]}
                  {!c.active && <Badge variant="outline">{t("catalog.hidden")}</Badge>}
                </p>
                <p className="text-xs break-words text-muted-foreground">
                  {LANGS.filter((l) => l !== locale)
                    .map((l) => c.name[l])
                    .join(" · ")}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  <span className="font-mono">{`/collections/${c.slug}`}</span>
                  {" · "}
                  {t("stores.products", { count: c.productCount })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={moving || i === 0}
                  aria-label={t("catalog.moveUp", { name: c.name[locale] })}
                  onClick={() => void move(i, -1)}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={moving || i === rows.length - 1}
                  aria-label={t("catalog.moveDown", { name: c.name[locale] })}
                  onClick={() => void move(i, 1)}
                >
                  <ArrowDown aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="pointer-coarse:h-11"
                  aria-label={t("actions.named", {
                    action: t("catalog.edit"),
                    name: c.name[locale],
                  })}
                  onClick={() => open(c)}
                >
                  <Pencil aria-hidden />
                  <span className="sr-only sm:not-sr-only">{t("catalog.edit")}</span>
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <AdminDialog
        open={draft !== null}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id === null ? t("catalog.addCollection") : t("catalog.editCollection")}
        description={t("catalog.collectionText")}
        submitLabel={t("catalog.save")}
        busy={form.busy}
        formError={form.errors.form}
        onSubmit={() => void save()}
      >
        {draft && (
          <>
            {LANGS.map((l) => (
              <Field key={l} label={t(`catalog.name.${l}`)} error={form.errors[`name.${l}`]}>
                {(props) => (
                  <input
                    {...props}
                    lang={l}
                    value={draft.name[l]}
                    maxLength={60}
                    onChange={(e) =>
                      setDraft({ ...draft, name: { ...draft.name, [l]: e.target.value } })
                    }
                    className={fieldClass}
                  />
                )}
              </Field>
            ))}
            <Field
              label={t("catalog.slug")}
              error={form.errors.slug}
              hint={draft.id === null ? t("catalog.slugHint") : t("catalog.slugChangeHint")}
            >
              {(props) => (
                <input
                  {...props}
                  value={draft.slug}
                  maxLength={40}
                  autoCapitalize="none"
                  spellCheck={false}
                  onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                  className={fieldClass}
                />
              )}
            </Field>
            <label className="flex min-h-11 items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                className="mt-0.5 size-5 shrink-0 accent-primary"
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{t("catalog.shown")}</span>
                <span className="text-xs text-muted-foreground">{t("catalog.shownHint")}</span>
              </span>
            </label>
          </>
        )}
      </AdminDialog>
    </Section>
  );
}

// ---------------------------------------------------------------- finenesses

function Finenesses({ initial }: { initial: AdminFineness[] }) {
  const t = useTranslations("Admin");
  const [rows, setRows] = useState(initial);
  const [open, setOpen] = useState(false);
  const [metal, setMetal] = useState<MetalType>("GOLD");
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const form = useAdminForm();

  async function add() {
    const created = await form.submit<AdminFineness, typeof finenessSchema>(
      "POST",
      "/api/admin/finenesses",
      finenessSchema,
      { metal, value: value.trim() === "" ? NaN : Number(value), label },
    );
    if (!created) return;
    setRows((all) => [...all, created]);
    setOpen(false);
    notices.show(t("catalog.added", { name: created.label }));
  }

  return (
    <Section
      id="finenesses"
      title={t("catalog.finenesses")}
      intro={t("catalog.finenessesIntro")}
      action={
        <AddButton
          label={t("catalog.addFineness")}
          onClick={() => {
            setMetal("GOLD");
            setValue("");
            setLabel("");
            form.setErrors({});
            setOpen(true);
          }}
        />
      }
    >
      {rows.length === 0 ? (
        <Empty text={t("catalog.noFinenesses")} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-3 rounded-lg border p-4"
            >
              <div className="flex flex-col gap-1">
                <p className="font-medium tabular-nums">{f.label}</p>
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{t(`metal.${f.metal}`)}</Badge>
                  <span className="tabular-nums">
                    {t("stores.products", { count: f.productCount })}
                  </span>
                </p>
              </div>
              <DeleteButton
                endpoint={`/api/admin/finenesses/${f.id}`}
                name={f.label}
                onDone={() => setRows((all) => all.filter((r) => r.id !== f.id))}
              />
            </li>
          ))}
        </ul>
      )}
      <AdminDialog
        open={open}
        onOpenChange={setOpen}
        title={t("catalog.addFineness")}
        description={t("catalog.finenessText")}
        submitLabel={t("catalog.save")}
        busy={form.busy}
        formError={form.errors.form}
        onSubmit={() => void add()}
      >
        <Field label={t("catalog.metal")} error={form.errors.metal}>
          {(props) => (
            <select
              {...props}
              value={metal}
              onChange={(e) => setMetal(e.target.value as MetalType)}
              className={fieldClass}
            >
              {METALS.map((m) => (
                <option key={m} value={m}>
                  {t(`metal.${m}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t("catalog.value")} error={form.errors.value} hint={t("catalog.valueHint")}>
          {(props) => (
            <input
              {...props}
              inputMode="numeric"
              value={value}
              maxLength={3}
              onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
              className={fieldClass}
            />
          )}
        </Field>
        <Field label={t("catalog.label")} error={form.errors.label} hint={t("catalog.labelHint")}>
          {(props) => (
            <input
              {...props}
              value={label}
              maxLength={20}
              onChange={(e) => setLabel(e.target.value)}
              className={fieldClass}
            />
          )}
        </Field>
      </AdminDialog>
    </Section>
  );
}

// ---------------------------------------------------------------- synonyms

function Synonyms({ initial }: { initial: SynonymPair[] }) {
  const t = useTranslations("Admin");
  const [rows, setRows] = useState(initial);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [synonym, setSynonym] = useState("");
  const form = useAdminForm();

  async function add() {
    const created = await form.submit<SynonymPair, typeof synonymSchema>(
      "POST",
      "/api/admin/synonyms",
      synonymSchema,
      { term, synonym },
    );
    if (!created) return;
    setRows((all) => [...all, created]);
    setOpen(false);
    notices.show(t("catalog.added", { name: `${created.term} = ${created.synonym}` }));
  }

  return (
    <Section
      id="synonyms"
      title={t("catalog.synonyms")}
      intro={t("catalog.synonymsIntro")}
      action={
        <AddButton
          label={t("catalog.addSynonym")}
          onClick={() => {
            setTerm("");
            setSynonym("");
            form.setErrors({});
            setOpen(true);
          }}
        />
      }
    >
      {rows.length === 0 ? (
        <Empty text={t("catalog.noSynonyms")} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((p) => {
            const name = `${p.term} = ${p.synonym}`;
            return (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-4"
              >
                <p className="flex min-w-0 flex-wrap items-center gap-2 break-words">
                  <span className="font-medium">{p.term}</span>
                  <ArrowLeftRight aria-hidden className="size-4 text-muted-foreground" />
                  <span className="sr-only">{t("catalog.same")}</span>
                  <span>{p.synonym}</span>
                </p>
                <DeleteButton
                  endpoint={`/api/admin/synonyms/${p.id}`}
                  name={name}
                  onDone={() => setRows((all) => all.filter((r) => r.id !== p.id))}
                />
              </li>
            );
          })}
        </ul>
      )}
      <AdminDialog
        open={open}
        onOpenChange={setOpen}
        title={t("catalog.addSynonym")}
        description={t("catalog.synonymText")}
        submitLabel={t("catalog.save")}
        busy={form.busy}
        formError={form.errors.form}
        onSubmit={() => void add()}
      >
        <Field label={t("catalog.term")} error={form.errors.term}>
          {(props) => (
            <input
              {...props}
              value={term}
              maxLength={60}
              onChange={(e) => setTerm(e.target.value)}
              className={fieldClass}
            />
          )}
        </Field>
        <Field label={t("catalog.synonym")} error={form.errors.synonym}>
          {(props) => (
            <input
              {...props}
              value={synonym}
              maxLength={60}
              onChange={(e) => setSynonym(e.target.value)}
              className={fieldClass}
            />
          )}
        </Field>
      </AdminDialog>
    </Section>
  );
}
