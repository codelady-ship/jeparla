import { CHECK_OF, type DocumentStatus } from "@/lib/api/admin-http";
import { ApiError } from "@/lib/api/http";
import { problemResponse } from "@/lib/api/problem";
import { userFetch } from "@/lib/auth/backend";
import { requestLocale } from "@/lib/auth/server";
import type { ProductStatus } from "@/types/api";
import type { StoreStatus } from "@/types/admin";
import type { Decision } from "./decisions";

/**
 * Backend error codes the panel explains in its own words (Admin.errors), with the field
 * they belong to. Anything else keeps the backend's own message (already in the admin's
 * language) or its generic key.
 */
const KNOWN: Record<string, [field: string, key: string]> = {
  "admin.slug_taken": ["slug", "taken"],
  "admin.parent_missing": ["parentId", "invalid"],
  "admin.category_cycle": ["parentId", "invalid"],
  "admin.category_in_use": ["form", "inUse"],
  "admin.fineness_exists": ["value", "taken"],
  "admin.fineness_in_use": ["form", "inUse"],
  "admin.synonym_exists": ["synonym", "taken"],
  "admin.synonym_invalid": ["synonym", "invalid"],
  "admin.self": ["form", "self"],
  "admin.last_admin": ["form", "lastAdmin"],
  "admin.user_owns_store": ["form", "ownsStore"],
  "admin.role_not_assignable": ["role", "invalid"],
  "admin.report_closed": ["form", "conflict"],
  "admin.reason_required": ["reason", "reasonRequired"],
  "auth.reset_link_not_allowed": ["form", "resetNotAllowed"],
};

export function adminProblem(e: unknown): Response {
  if (e instanceof ApiError && e.code && KNOWN[e.code]) {
    const [field, key] = KNOWN[e.code];
    return Response.json({ errors: { [field]: key }, code: e.code }, { status: e.status });
  }
  return problemResponse(e);
}

/**
 * One admin call on the real API as the signed-in admin. The route handler has already
 * checked the form; the backend checks the ADMIN role and the transition (409 when stale)
 * and writes the audit log and any seller notification.
 */
export async function adminCall<T, R = T>(
  request: Request,
  path: string,
  {
    method = "POST",
    body,
    pick,
    status = 200,
  }: {
    method?: "POST" | "PATCH" | "PUT" | "DELETE";
    body?: unknown;
    pick?: (data: T) => R;
    status?: number;
  } = {},
): Promise<Response> {
  try {
    const data = await userFetch<T>(path, {
      method,
      body,
      canRefresh: true,
      locale: requestLocale(request),
    });
    if (data === null || data === undefined) return new Response(null, { status: 204 });
    return Response.json(pick ? pick(data) : data, { status });
  } catch (e) {
    return adminProblem(e);
  }
}

/** Decisions answer `{ status, note }` like the demo. */
const call = <T>(
  request: Request,
  path: string,
  body: unknown,
  pick: (data: T) => { status: string; note: string | null },
  method: "POST" | "PATCH" | "PUT" = "POST",
) => adminCall<T, { status: string; note: string | null }>(request, path, { method, body, pick });

const reason = (d: Decision) => d.reason || null;

const STORE_TO: Record<string, StoreStatus> = {
  approve: "APPROVED",
  reject: "REJECTED",
  block: "BLOCKED",
  unblock: "APPROVED",
};

export function decideStore(request: Request, id: number, d: Decision) {
  const status = STORE_TO[d.action];
  if (!status) return Response.json({ errors: { form: "conflict" } }, { status: 409 });
  return call<{ status: StoreStatus; statusNote: string | null }>(
    request,
    `/admin/stores/${id}/status`,
    { status, reason: reason(d) },
    (s) => ({ status: s.status, note: s.statusNote }),
  );
}

const PRODUCT_TO: Record<string, string> = {
  approve: "APPROVE",
  return: "RETURN",
  deactivate: "DEACTIVATE",
};

export function decideProduct(request: Request, id: number, d: Decision) {
  const decision = PRODUCT_TO[d.action];
  if (!decision) return Response.json({ errors: { form: "conflict" } }, { status: 409 });
  return call<{ status: ProductStatus; reviewNote: string | null }>(
    request,
    `/admin/products/${id}/decision`,
    { decision, reason: reason(d) },
    (p) => ({ status: p.status, note: p.reviewNote }),
  );
}

/** verify = APPROVE; return = REQUEST_CHANGES (the seller uploads again); reject = REJECT. */
const DOCUMENT_TO: Record<string, string> = {
  verify: "APPROVE",
  return: "REQUEST_CHANGES",
  reject: "REJECT",
};

export function decideDocument(request: Request, id: string, d: Decision) {
  const decision = DOCUMENT_TO[d.action];
  if (!decision) return Response.json({ errors: { form: "conflict" } }, { status: 409 });
  if (decision !== "APPROVE" && !d.code)
    return Response.json({ errors: { code: "codeRequired" } }, { status: 400 });
  return call<{ status: DocumentStatus; reviewNote: string | null }>(
    request,
    `/admin/documents/${id}/decision`,
    { decision, reason: decision === "APPROVE" ? null : d.code, note: reason(d) },
    (doc) => ({ status: CHECK_OF[doc.status], note: doc.reviewNote }),
  );
}

export function decideQuote(request: Request, metal: string, d: Decision) {
  return call<{ status: string; note: string | null }>(
    request,
    `/admin/metal-prices/${metal}/held`,
    { action: d.action, reason: reason(d) },
    (q) => ({ status: q.status, note: q.note }),
    "PATCH",
  );
}

/** Seller identity check of a store: verify or reject (both written to the audit log). */
export function decideSellerCheck(request: Request, storeId: number, d: Decision) {
  const decision = d.action === "verify" ? "VERIFIED" : "REJECTED";
  return call<{ sellerStatus: string }>(
    request,
    `/admin/stores/${storeId}/seller-check`,
    { decision, reason: reason(d) },
    (s) => ({ status: s.sellerStatus, note: reason(d) }),
  );
}

/** Resolve or dismiss a complaint; the note always goes with it. */
export function decideReport(request: Request, id: number, d: Decision) {
  const status = d.action === "resolve" ? "RESOLVED" : d.action === "dismiss" ? "DISMISSED" : null;
  if (!status) return Response.json({ errors: { form: "conflict" } }, { status: 409 });
  return call<{ status: string; note: string | null }>(
    request,
    `/admin/reports/${id}/resolution`,
    { status, note: reason(d) },
    (r) => ({ status: r.status, note: r.note }),
  );
}
