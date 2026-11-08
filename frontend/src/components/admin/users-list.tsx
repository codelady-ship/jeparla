"use client";

import { UserCog } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { REASON_MAX, REASON_MIN } from "@/lib/admin/decisions";
import { filterList, shortDate, USER_FILTERS } from "@/lib/admin/filter";
import { ROLES, roleSchema } from "@/lib/admin/settings";
import type { Role } from "@/lib/auth/session";
import { notices } from "@/lib/notice";
import type { AdminUser } from "@/types/admin";
import { AdminDialog, Field, fieldClass, ReasonField, useAdminForm } from "./admin-dialog";
import { EmptyFiltered, ListToolbar, useListFilter } from "./list-toolbar";

type Filter = (typeof USER_FILTERS)[number];

const VARIANT: Record<Role, "default" | "gold" | "outline"> = {
  ADMIN: "gold",
  MERCHANT: "default",
  USER: "outline",
};

/** Accounts and roles. A role change is confirmed and needs a reason for the audit log. */
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
    rows.map((r) => ({ ...r, status: r.role })),
    filter.q,
    filter.status,
    (r) => `${r.name} ${r.email} ${r.storeName ?? ""}`,
  );

  const badge = (r: Role) => <Badge variant={VARIANT[r]}>{t(`role.${r}`)}</Badge>;
  const change = (row: AdminUser) => (
    <RoleButton
      user={row}
      onDone={(role) => setRows((all) => all.map((r) => (r.id === row.id ? { ...r, role } : r)))}
    />
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
                    <p className="text-sm break-all text-muted-foreground">{row.email}</p>
                    {row.storeName && <p className="text-sm">{row.storeName}</p>}
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {t("users.since", { date: shortDate(row.createdAt) })}
                    </p>
                  </div>
                  {badge(row.role)}
                </div>
                {change(row)}
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
                        <span className="text-xs text-muted-foreground">{row.email}</span>
                      </div>
                    </th>
                    <td className="p-3">{row.storeName ?? "-"}</td>
                    <td className="p-3 whitespace-nowrap tabular-nums">
                      {shortDate(row.createdAt)}
                    </td>
                    <td className="p-3">{badge(row.role)}</td>
                    <td className="p-3">{change(row)}</td>
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
