import { problemResponse } from "@/lib/api/problem";
import { authCall, sessionOf, startSession } from "@/lib/auth/backend";
import { fieldErrors, registerSchema } from "@/lib/auth/schemas";
import { DEMO_AUTH, readJson, requestLocale, writeSession } from "@/lib/auth/server";

/** Buyers register here (POST /api/v1/auth/register); sellers go through the /sell wizard. */
export async function POST(request: Request) {
  const parsed = registerSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ errors: fieldErrors(parsed.error) }, { status: 400 });
  const { name, email, password } = parsed.data;
  if (DEMO_AUTH) {
    const session = { name, email, role: "USER" as const };
    await writeSession(session);
    return Response.json({ session }, { status: 201 });
  }
  try {
    const { auth, refreshToken } = await authCall(
      "/register",
      { name, email, password },
      { locale: requestLocale(request) },
    );
    await startSession(auth, refreshToken);
    return Response.json({ session: sessionOf(auth.user) }, { status: 201 });
  } catch (e) {
    return problemResponse(e);
  }
}
