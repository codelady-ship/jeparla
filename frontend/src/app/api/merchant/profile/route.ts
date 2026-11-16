import { USING_MOCK } from "@/lib/api";
import { problemResponse } from "@/lib/api/problem";
import { userFetch } from "@/lib/auth/backend";
import { fieldErrors } from "@/lib/auth/schemas";
import { readJson, requestLocale } from "@/lib/auth/server";
import { normalizePhone } from "@/lib/seller/schemas";
import { invalidDays, parseWeek } from "@/lib/merchant/hours";
import { profileSchema } from "@/lib/merchant/schemas";
import { merchantOr401 } from "@/lib/merchant/server";

type StoredStore = { phone: string | null; sellerKind: string };

/** PUT /api/v1/merchant/store: the store profile. */
export async function PUT(request: Request) {
  const session = await merchantOr401();
  if (session instanceof Response) return session;
  const parsed = profileSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ errors: fieldErrors(parsed.error) }, { status: 400 });
  const profile = parsed.data;
  if (invalidDays(parseWeek(profile.openingHours)).length > 0)
    return Response.json({ errors: { openingHours: "hoursInvalid" } }, { status: 400 });
  const whatsapp = normalizePhone(profile.whatsapp) ?? profile.whatsapp;
  if (USING_MOCK) return Response.json({ profile: { ...profile, whatsapp } });
  try {
    const locale = requestLocale(request);
    // Fields the form does not edit (the second phone) are kept.
    const stored = await userFetch<StoredStore>("/merchant/store", { canRefresh: true, locale });
    const saved = await userFetch<typeof profile>("/merchant/store", {
      method: "PUT",
      canRefresh: true,
      locale,
      body: {
        ...profile,
        whatsapp,
        phone: stored.phone,
        // The backend refuses a change that would leave listed products or checked documents
        // without a matching kind (409 merchant.seller_kind_conflict, #128).
        sellerKind: profile.sellerKind ?? stored.sellerKind,
      },
    });
    return Response.json({ profile: saved });
  } catch (e) {
    return problemResponse(e);
  }
}
