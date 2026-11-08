import { z } from "zod";
import type { CheckStatus, ProductStatus } from "@/types/api";
import type { StoreStatus } from "@/types/admin";

/**
 * What an admin may do with a store, a product or a verification request, and
 * the status each decision leads to. The browser uses it to show the buttons,
 * the route handlers to refuse stale or forged decisions (409). The backend
 * holds the real rules (PLAN 5.8); these mirror them.
 */

export type StoreAction = "approve" | "reject" | "block" | "unblock";
export type ProductAction = "approve" | "return" | "deactivate";
export type CheckAction = "verify" | "return";
export type AdminAction = StoreAction | ProductAction | CheckAction;

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
  PENDING: ["verify", "return"],
  NONE: [],
  VERIFIED: [],
  REJECTED: [],
};
const CHECK_RESULT: Record<CheckAction, CheckStatus> = {
  verify: "VERIFIED",
  return: "REJECTED",
};

/** Decisions the seller must be told the reason for; they also get the red button. */
export const NEEDS_REASON: ReadonlySet<AdminAction> = new Set<AdminAction>([
  "reject",
  "block",
  "return",
  "deactivate",
]);

export const REASON_MIN = 10;
export const REASON_MAX = 500;

export const decisionSchema = z
  .object({
    action: z.string(),
    reason: z.string().trim().max(REASON_MAX, "reasonTooLong").optional().default(""),
  })
  .superRefine((v, ctx) => {
    if (NEEDS_REASON.has(v.action as AdminAction) && v.reason.length < REASON_MIN)
      ctx.addIssue({ code: "custom", path: ["reason"], message: "reasonRequired" });
  });

export type Decision = z.infer<typeof decisionSchema>;

type Target = "store" | "product" | "check";

const TABLES = {
  store: [STORE_ACTIONS, STORE_RESULT],
  product: [PRODUCT_ACTIONS, PRODUCT_RESULT],
  check: [CHECK_ACTIONS, CHECK_RESULT],
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
export function nextStatus(target: Target, current: string, action: string): string | null {
  const [allowed, result] = TABLES[target] as unknown as [
    Record<string, readonly string[]>,
    Record<string, string>,
  ];
  return allowed[current]?.includes(action) ? result[action] : null;
}
