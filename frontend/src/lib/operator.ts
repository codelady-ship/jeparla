/**
 * The operator named on the legal pages (#57): legal name, VOEN and registered address, from
 * NEXT_PUBLIC_OPERATOR_NAME / _TAX_ID / _ADDRESS (production: JEPARLA_OPERATOR_* build args).
 * Nothing is invented: an unset value is null and the page shows a visible owner's-details marker.
 * A VOEN is 10 digits; anything else is ignored rather than shown wrong.
 */
export type OperatorDetails = { name: string | null; taxId: string | null; address: string | null };

const VOEN = /^\d{10}$/;

export function operatorDetails(
  name: string | undefined = process.env.NEXT_PUBLIC_OPERATOR_NAME,
  taxId: string | undefined = process.env.NEXT_PUBLIC_OPERATOR_TAX_ID,
  address: string | undefined = process.env.NEXT_PUBLIC_OPERATOR_ADDRESS,
): OperatorDetails {
  const clean = (v: string | undefined) => {
    const s = v?.trim() ?? "";
    return s === "" ? null : s;
  };
  const voen = clean(taxId)?.replace(/\s/g, "") ?? null;
  return {
    name: clean(name),
    taxId: voen && VOEN.test(voen) ? voen : null,
    address: clean(address),
  };
}
