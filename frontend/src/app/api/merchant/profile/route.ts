import { AUTH_AVAILABLE, readJson, unavailable } from "@/lib/auth/server";
import { fieldErrors } from "@/lib/auth/schemas";
import { normalizePhone } from "@/lib/seller/schemas";
import { invalidDays, parseWeek } from "@/lib/merchant/hours";
import { profileSchema } from "@/lib/merchant/schemas";
import { merchantOr401 } from "@/lib/merchant/server";

/** PUT /api/v1/merchant/store (demo): validates and echoes the saved profile. */
export async function PUT(request: Request) {
  if (!AUTH_AVAILABLE) return unavailable();
  const session = await merchantOr401();
  if (session instanceof Response) return session;
  const parsed = profileSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ errors: fieldErrors(parsed.error) }, { status: 400 });
  const profile = parsed.data;
  if (invalidDays(parseWeek(profile.openingHours)).length > 0)
    return Response.json({ errors: { openingHours: "hoursInvalid" } }, { status: 400 });
  return Response.json({
    profile: { ...profile, whatsapp: normalizePhone(profile.whatsapp) ?? profile.whatsapp },
  });
}
