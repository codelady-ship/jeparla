/** Error codes the admin forms and route handlers send; each is a key under Admin.errors. */
export const ADMIN_ERRORS = [
  "reasonRequired",
  "reasonTooLong",
  "conflict",
  "sessionExpired",
  "unavailable",
  "network",
  "server",
  "required",
  "tooLong",
  "tooMany",
  "slugFormat",
  "valueRange",
  "priceFormat",
  "taken",
  "invalid",
  "inUse",
  "self",
  "sameRole",
  "lastAdmin",
  "largeChange",
  "codeRequired",
  "rateLimited",
  "ownsStore",
  "resetNotAllowed",
] as const;

export type AdminError = (typeof ADMIN_ERRORS)[number];

/** A server or schema error code as a message key; unknown codes read as a server error. */
export const errorKey = (code: string): AdminError =>
  ADMIN_ERRORS.includes(code as AdminError) ? (code as AdminError) : "server";
