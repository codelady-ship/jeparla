import { AUTH_AVAILABLE, readJson, unavailable, writeSession } from "@/lib/auth/server";
import { fieldErrors, registerSchema } from "@/lib/auth/schemas";

/** Buyers register here; sellers go through the /sell wizard (#22). */
export async function POST(request: Request) {
  if (!AUTH_AVAILABLE) return unavailable();
  const parsed = registerSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ errors: fieldErrors(parsed.error) }, { status: 400 });
  const { name, email } = parsed.data;
  const session = { name, email, role: "USER" as const };
  await writeSession(session);
  return Response.json({ session }, { status: 201 });
}
