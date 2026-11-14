import Big from "big.js";
import { z } from "zod";
import { percentChange } from "@/lib/pricing";
import type { Decimal } from "@/types/api";
import { REASON_MAX, REASON_MIN } from "./decisions";

/**
 * Admin forms that are not a status decision: catalog settings, role changes
 * and the metal price override. The dialogs and the route handlers parse with
 * the same schemas; messages are keys under Admin.errors.
 */

const METALS = ["GOLD", "SILVER", "PLATINUM", "PALLADIUM"] as const;
export const ROLES = ["USER", "MERCHANT", "ADMIN"] as const;

const reason = z.string().trim().min(REASON_MIN, "reasonRequired").max(REASON_MAX, "reasonTooLong");

const text = (max: number) => z.string().trim().min(1, "required").max(max, "tooLong");

export const categorySchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slugFormat")
    .min(2, "slugFormat")
    .max(40, "tooLong"),
  parentId: z.number().int().positive().nullable().default(null),
  name: z.object({ az: text(60), en: text(60), ru: text(60) }),
});

export const finenessSchema = z.object({
  metal: z.enum(METALS),
  value: z.number("valueRange").int("valueRange").min(1, "valueRange").max(999, "valueRange"),
  label: text(20),
});

/** One pair: search treats the two words as the same query, both ways. */
export const synonymSchema = z
  .object({ term: text(60), synonym: text(60) })
  .refine((v) => v.term.toLowerCase() !== v.synonym.toLowerCase(), {
    path: ["synonym"],
    message: "invalid",
  });

export const roleSchema = z.object({ role: z.enum(ROLES), reason });

/** Block or unblock an account; the reason goes to the audit log. */
export const userStatusSchema = z.object({ status: z.enum(["ACTIVE", "BLOCKED"]), reason });

/** AZN per troy ounce, at most 2 decimals; NUMERIC on the backend, never a float. */
const DECIMAL = /^\d{1,7}(\.\d{1,2})?$/;

export const overrideSchema = z.object({
  pricePerOunce: z
    .string()
    .trim()
    .transform((v) => v.replace(",", "."))
    .refine((v) => DECIMAL.test(v) && new Big(v).gt(0), "priceFormat"),
  reason,
  /** The admin ticked "I checked the source" for a change above the sanity limit. */
  confirmLarge: z.boolean().optional().default(false),
});

/** Above this daily change (percent) a price is never applied without a person (PLAN 5.10). */
export const SANITY_LIMIT = "10";

/** Percent change from the price in use and whether it is above the sanity limit. */
export function priceJump(current: Decimal, next: Decimal): { change: Decimal; large: boolean } {
  const change = percentChange(current, next);
  return { change, large: new Big(change).abs().gt(SANITY_LIMIT) };
}

export type CategoryInput = z.infer<typeof categorySchema>;
export type FinenessInput = z.infer<typeof finenessSchema>;
export type SynonymInput = z.infer<typeof synonymSchema>;
export type RoleInput = z.infer<typeof roleSchema>;
export type OverrideInput = z.infer<typeof overrideSchema>;

/** Zod issues as { field: messageKey }, the first issue of each field. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) {
    const key = i.path.length ? i.path.map(String).join(".") : "form";
    out[key] ??= i.message;
  }
  return out;
}
