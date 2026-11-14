import { z } from "zod";
import type { CheckStatus, ProductStatus } from "@/types/api";
import type { QuoteStatus, ReportStatus, StoreStatus } from "@/types/admin";

/**
 * What an admin may do with a store, a product or a verification request, and
 * the status each decision leads to. The browser uses it to show the buttons,
 * the route handlers to refuse stale or forged decisions (409). The backend
 * holds the real rules (PLAN 5.8); these mirror them.
 */

export type StoreAction = "approve" | "reject" | "block" | "unblock";
export type ProductAction = "approve" | "return" | "deactivate";
export type CheckAction = "verify" | "return" | "reject";
export type ReportAction = "resolve" | "dismiss";
export type QuoteAction = "accept" | "discard";
export type AdminAction = StoreAction | ProductAction | CheckAction | ReportAction | QuoteAction;

export const STORE_ACTIONS: Record<StoreStatus, readonly StoreAction[]> = {
  PENDING: ["approve", "reject"],
  APPROVED: ["block"],
  REJECTED: ["approve"],
  BLOCKED: ["unblock"],
};
const STORE_RESULT: Record<StoreAction, StoreStatus> = {
  approve: "APPROVED",
  reject: "REJECTED",
  block: "BLOCKED",
  unblock: "APPROVED",
};

export const PRODUCT_ACTIONS: Record<ProductStatus, readonly ProductAction[]> = {
  IN_REVIEW: ["approve", "return"],
  APPROVED: ["deactivate"],
  DRAFT: [],
  RETURNED: [],
  INACTIVE: [],
};
const PRODUCT_RESULT: Record<ProductAction, ProductStatus> = {
  approve: "APPROVED",
  return: "RETURNED",
  deactivate: "INACTIVE",
};

export const CHECK_ACTIONS: Record<CheckStatus, readonly CheckAction[]> = {
  PENDING: ["verify", "return", "reject"],
  NONE: [],
  VERIFIED: [],
  REJECTED: [],
};
const CHECK_RESULT: Record<CheckAction, CheckStatus> = {
  verify: "VERIFIED",
  return: "REJECTED",
  reject: "REJECTED",
};

export const REPORT_ACTIONS: Record<ReportStatus, readonly ReportAction[]> = {
  OPEN: ["resolve", "dismiss"],
  RESOLVED: [],
  DISMISSED: [],
};
const REPORT_RESULT: Record<ReportAction, ReportStatus> = {
  resolve: "RESOLVED",
  dismiss: "DISMISSED",
};

/** A held metal quote (change above the sanity limit) is applied or thrown away by hand. */
export const QUOTE_ACTIONS: Record<QuoteStatus, readonly QuoteAction[]> = {
  HELD: ["accept", "discard"],
  APPLIED: [],
  DISCARDED: [],
};
const QUOTE_RESULT: Record<QuoteAction, QuoteStatus> = {
  accept: "APPLIED",
  discard: "DISCARDED",
};

/** Decisions the seller must be told the reason for; they also get the red button. */
export const NEEDS_REASON: ReadonlySet<AdminAction> = new Set<AdminAction>([
  "reject",
  "block",
  "return",
  "deactivate",
  "dismiss",
  "discard",
]);

/** Why a verification document is refused (backend RejectReason). */
export const DOCUMENT_REASONS = [
  "UNREADABLE",
  "EXPIRED",
  "MISMATCH",
  "WRONG_TYPE",
  "HALLMARK_MISSING",
  "AUTHENTICITY",
] as const;

export const REASON_MIN = 10;
export const REASON_MAX = 500;

export const decisionSchema = z
  .object({
    action: z.string(),
    reason: z.string().trim().max(REASON_MAX, "reasonTooLong").optional().default(""),
    /** Why a document was refused, from DOCUMENT_REASONS (the API needs one). */
    code: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (NEEDS_REASON.has(v.action as AdminAction) && v.reason.length < REASON_MIN)
      ctx.addIssue({ code: "custom", path: ["reason"], message: "reasonRequired" });
  });

export type Decision = z.infer<typeof decisionSchema>;

type Target = "store" | "product" | "check" | "report" | "quote";

const TABLES = {
  store: [STORE_ACTIONS, STORE_RESULT],
  product: [PRODUCT_ACTIONS, PRODUCT_RESULT],
  check: [CHECK_ACTIONS, CHECK_RESULT],
  report: [REPORT_ACTIONS, REPORT_RESULT],
  quote: [QUOTE_ACTIONS, QUOTE_RESULT],
} as const;

/** The status after `action`, or null when the action is not allowed from `current`. */
export function nextStatus(
  target: "store",
  current: StoreStatus,
  action: string,
): StoreStatus | null;
export function nextStatus(
  target: "product",
  current: ProductStatus,
  action: string,
): ProductStatus | null;
export function nextStatus(
  target: "check",
  current: CheckStatus,
  action: string,
): CheckStatus | null;
export function nextStatus(
  target: "report",
  current: ReportStatus,
  action: string,
): ReportStatus | null;
export function nextStatus(
  target: "quote",
  current: QuoteStatus,
  action: string,
): QuoteStatus | null;
export function nextStatus(target: Target, current: string, action: string): string | null {
  const [allowed, result] = TABLES[target] as unknown as [
    Record<string, readonly string[]>,
    Record<string, string>,
  ];
  return allowed[current]?.includes(action) ? result[action] : null;
}
