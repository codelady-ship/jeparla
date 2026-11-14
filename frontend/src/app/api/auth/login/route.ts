import { problemResponse } from "@/lib/api/problem";
import { authCall, sessionOf, startSession } from "@/lib/auth/backend";
import { fieldErrors, loginSchema } from "@/lib/auth/schemas";
import { DEMO_AUTH, mockRoleFor, readJson, requestLocale, writeSession } from "@/lib/auth/server";

/** POST /api/v1/auth/login for the browser: the tokens stay in httpOnly cookies of this site. */
export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ errors: fieldErrors(parsed.error) }, { status: 400 });
  const { login, password } = parsed.data;
  if (DEMO_AUTH) {
    const session = { name: login.split("@")[0], email: login, role: mockRoleFor(login) };
    await writeSession(session);
    return Response.json({ session });
  }
  try {
    const { auth, refreshToken } = await authCall(
      "/login",
      { login, password },
      { locale: requestLocale(request) },
    );
    await startSession(auth, refreshToken);
    return Response.json({ session: sessionOf(auth.user) });
  } catch (e) {
    return problemResponse(e);
  }
}
