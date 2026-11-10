import { CHECK_OF, type DocumentStatus } from "@/lib/api/admin-http";
import { problemResponse } from "@/lib/api/problem";
import { userFetch } from "@/lib/auth/backend";
import { requestLocale } from "@/lib/auth/server";
import type { ProductStatus } from "@/types/api";
import type { StoreStatus } from "@/types/admin";
import type { Decision } from "./decisions";

/**
 * Admin decisions on the real API. The route handler has already checked the reason;
 * the backend checks the ADMIN role, the transition (409 when stale) and writes the
 * audit log and the seller notification. Answers `{ status, note }` like the demo.
 */
async function call<T>(
  request: Request,
  path: string,
  body: unknown,
  pick: (data: T) => { status: string; note: string | null },
  method: "POST" | "PATCH" | "PUT" = "POST",
): Promise<Response> {
  try {
    const data = await userFetch<T>(path, {
      method,
      body,
      canRefresh: true,
      locale: requestLocale(request),
    });
    return Response.json(pick(data));
  } catch (e) {
    return problemResponse(e);
  }
}

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
