"use client";

import { Ban, Check, Copy, KeyRound, RotateCcw, TriangleAlert, UserCog } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { REASON_MAX, REASON_MIN } from "@/lib/admin/decisions";
import { filterList, shortDate, USER_FILTERS } from "@/lib/admin/filter";
import { ROLES, roleSchema, userStatusSchema } from "@/lib/admin/settings";
import type { Role } from "@/lib/auth/session";
import { notices } from "@/lib/notice";
import type { AdminUser, UserStatus } from "@/types/admin";
import { AdminDialog, Field, fieldClass, ReasonField, useAdminForm } from "./admin-dialog";
import { EmptyFiltered, ListToolbar, useListFilter } from "./list-toolbar";

type Filter = (typeof USER_FILTERS)[number];

const VARIANT: Record<Role, "default" | "gold" | "outline"> = {
  ADMIN: "gold",
  MERCHANT: "default",
  USER: "outline",
};

/**
 * Accounts and roles. Role changes and blocks are confirmed and need a reason for the
 * audit log. A seller who signed up with a phone only gets a one-time reset link here.
 */
export function UsersList({
  rows: initial,
  initialQuery,
  initialStatus,
}: {
  rows: AdminUser[];
  initialQuery: string;
  initialStatus: Filter;
}) {
  const t = useTranslations("Admin");
  const [rows, setRows] = useState(initial);
  const filter = useListFilter<Filter>(initialQuery, initialStatus, "ALL");
  // filterList filters on .status; for users the filter is the role.
  const shown = filterList(
    rows.map((user) => ({ user, status: user.role })),
    filter.q,
    filter.status,
    ({ user: r }) => `${r.name} ${r.email ?? ""} ${r.phone ?? ""} ${r.storeName ?? ""}`,
  ).map((r) => r.user);

  const update = (id: number, patch: Partial<AdminUser>) =>
    setRows((all) => all.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const badges = (r: AdminUser) => (
    <div className="flex flex-wrap gap-1">
      <Badge variant={VARIANT[r.role]}>{t(`role.${r.role}`)}</Badge>
      {r.status === "BLOCKED" && <Badge variant="destructive">{t("users.blocked")}</Badge>}
    </div>
  );
  const contact = (r: AdminUser) => r.email ?? r.phone ?? "";
  const actions = (row: AdminUser) => (
    <div className="flex flex-wrap gap-2">
      <RoleButton user={row} onDone={(role) => update(row.id, { role })} />
      <StatusButton user={row} onDone={(status) => update(row.id, { status })} />
      {!row.email && row.phone && row.role !== "ADMIN" && row.status === "ACTIVE" && (
        <ResetLinkButton user={row} />
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <ListToolbar
        filter={filter}
        options={USER_FILTERS.map((s) => ({
          value: s,
          label: s === "ALL" ? t("storeStatus.ALL") : t(`role.${s}`),
        }))}
        labels={{ search: t("users.search"), status: t("users.roleLabel") }}
      />
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t("users.count", { count: shown.length })}
      </p>

      {shown.length === 0 ? (
        <EmptyFiltered
          text={t("emptyFiltered")}
          clearLabel={t("clearFilters")}
          onClear={filter.clear}
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3 md:hidden">
            {shown.map((row) => (
              <li key={row.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="font-medium break-words">{row.name}</p>
                    <p className="text-sm break-all text-muted-foreground">{contact(row)}</p>
                    {row.storeName && <p className="text-sm">{row.storeName}</p>}
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {t("users.since", { date: shortDate(row.createdAt) })}
                    </p>
                  </div>
                  {badges(row)}
                </div>
                {actions(row)}
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th scope="col" className="p-3 font-medium">
                    {t("users.colUser")}
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    {t("users.colStore")}
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    {t("users.colSince")}
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    {t("users.roleLabel")}
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    {t("colActions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.id} className="border-t align-middle">
                    <th scope="row" className="p-3 text-left font-normal">
                      <div className="flex flex-col">
                        <span className="font-medium">{row.name}</span>
                        <span className="text-xs break-all text-muted-foreground">
                          {contact(row)}
                        </span>
                      </div>
                    </th>
                    <td className="p-3">{row.storeName ?? "-"}</td>
                    <td className="p-3 whitespace-nowrap tabular-nums">
                      {shortDate(row.createdAt)}
                    </td>
                    <td className="p-3">{badges(row)}</td>
                    <td className="p-3">{actions(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function RoleButton({ user, onDone }: { user: AdminUser; onDone: (role: Role) => void }) {
  const t = useTranslations("Admin");
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>(user.role);
  const [reason, setReason] = useState("");
  const form = useAdminForm();

  async function save() {
    if (role === user.role) {
      form.setErrors({ role: "sameRole" });
      return;
    }
    const done = await form.submit<{ role: Role }, typeof roleSchema>(
      "PATCH",
      `/api/admin/users/${user.id}`,
      roleSchema,
      { role, reason },
    );
    if (!done) return;
    setOpen(false);
    onDone(done.role);
    notices.show(t("done", { name: user.name, status: t(`role.${done.role}`) }));
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="lg"
        aria-label={t("actions.named", { action: t("users.change"), name: user.name })}
        onClick={() => {
          setRole(user.role);
          setReason("");
          form.setErrors({});
          setOpen(true);
        }}
      >
        <UserCog aria-hidden />
        {t("users.change")}
      </Button>
      <AdminDialog
        open={open}
        onOpenChange={setOpen}
        title={t("users.changeTitle", { name: user.name })}
        description={t("users.changeText")}
        submitLabel={t("users.change")}
        destructive={user.role === "ADMIN" || role === "ADMIN"}
        busy={form.busy}
        formError={form.errors.form}
        onSubmit={() => void save()}
      >
        <Field label={t("users.newRole")} error={form.errors.role}>
          {(props) => (
            <select
              {...props}
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className={fieldClass}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`role.${r}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
        {role === "ADMIN" && user.role !== "ADMIN" && (
          <p className="rounded-md bg-muted p-2 text-sm">{t("users.adminWarning")}</p>
        )}
        <ReasonField
          label={t("reason.audit")}
          hint={t("reason.hint", { min: REASON_MIN, max: REASON_MAX })}
          value={reason}
          onChange={setReason}
          error={form.errors.reason}
          max={REASON_MAX}
        />
      </AdminDialog>
    </>
  );
}

/** Block (signs the account out and stops sign-in) or unblock, with a reason. */
function StatusButton({ user, onDone }: { user: AdminUser; onDone: (status: UserStatus) => void }) {
  const t = useTranslations("Admin");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const form = useAdminForm();
  const blocking = user.status === "ACTIVE";
  const next: UserStatus = blocking ? "BLOCKED" : "ACTIVE";
  const label = blocking ? t("users.block") : t("users.unblock");

  async function save() {
    const done = await form.submit<{ status: UserStatus }, typeof userStatusSchema>(
      "PATCH",
      `/api/admin/users/${user.id}/status`,
      userStatusSchema,
      { status: next, reason },
    );
    if (!done) return;
    setOpen(false);
    onDone(done.status);
    notices.show(
      t("done", {
        name: user.name,
        status: done.status === "BLOCKED" ? t("users.blocked") : t("users.active"),
      }),
    );
  }

  return (
    <>
      <Button
        type="button"
        variant={blocking ? "destructive" : "outline"}
        size="lg"
        aria-label={t("actions.named", { action: label, name: user.name })}
        onClick={() => {
          setReason("");
          form.setErrors({});
          setOpen(true);
        }}
      >
        {blocking ? <Ban aria-hidden /> : <RotateCcw aria-hidden />}
        {label}
      </Button>
      <AdminDialog
        open={open}
        onOpenChange={setOpen}
        title={
          blocking
            ? t("users.blockTitle", { name: user.name })
            : t("users.unblockTitle", { name: user.name })
        }
        description={blocking ? t("users.blockText") : t("users.unblockText")}
        submitLabel={label}
        destructive={blocking}
        busy={form.busy}
        formError={form.errors.form}
        onSubmit={() => void save()}
      >
        <ReasonField
          label={t("reason.audit")}
          hint={t("reason.hint", { min: REASON_MIN, max: REASON_MAX })}
          value={reason}
          onChange={setReason}
          error={form.errors.reason}
          max={REASON_MAX}
        />
      </AdminDialog>
    </>
  );
}

/**
 * A one-time password reset link for a seller without an email. The link is shown once,
 * only in this dialog, and is gone when it closes; the admin passes it to the seller
 * through a channel they trust (the seller's own phone number).
 */
function ResetLinkButton({ user }: { user: AdminUser }) {
  const t = useTranslations("Admin");
  const [confirming, setConfirming] = useState(false);
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const form = useAdminForm();
  const label = t("users.resetLink");

  async function issue() {
    const done = await form.submit<{ url: string; expiresAt: string }, z.ZodUnknown>(
      "POST",
      `/api/admin/users/${user.id}/reset-link`,
      z.unknown(),
      {},
    );
    if (!done) return;
    setConfirming(false);
    setCopied(false);
    setLink(done);
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="lg"
        aria-label={t("actions.named", { action: label, name: user.name })}
        onClick={() => {
          form.setErrors({});
          setConfirming(true);
        }}
      >
        <KeyRound aria-hidden />
        {label}
      </Button>
      <AdminDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("users.resetTitle", { name: user.name })}
        description={t("users.resetText", { phone: user.phone ?? "" })}
        submitLabel={label}
        busy={form.busy}
        formError={form.errors.form}
        onSubmit={() => void issue()}
      />
      <Dialog open={link !== null} onOpenChange={(o) => !o && setLink(null)}>
        {link && (
          <DialogContent closeLabel={t("confirm.close")}>
            <DialogHeader>
              <DialogTitle>{t("users.linkTitle", { name: user.name })}</DialogTitle>
              <DialogDescription>
                {t("users.linkExpires", {
                  date: `${shortDate(link.expiresAt)} ${link.expiresAt.slice(11, 16)}`,
                })}
              </DialogDescription>
            </DialogHeader>
            <p
              role="note"
              className="flex gap-2 rounded-md border border-destructive/40 p-3 text-sm"
            >
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
              {t("users.linkWarning")}
            </p>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t("users.linkLabel")}
              <input
                readOnly
                value={link.url}
                onFocus={(e) => e.currentTarget.select()}
                className={`${fieldClass} font-mono text-xs`}
              />
            </label>
            <p aria-live="polite" className="sr-only">
              {copied ? t("users.copied") : ""}
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLink(null)}>
                {t("confirm.close")}
              </Button>
              <Button type="button" onClick={() => void copy()}>
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                {copied ? t("users.copied") : t("users.copy")}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
