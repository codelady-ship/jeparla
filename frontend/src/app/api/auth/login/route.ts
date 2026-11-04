import {
  AUTH_AVAILABLE,
  mockRoleFor,
  readJson,
  unavailable,
  writeSession,
} from "@/lib/auth/server";
import { fieldErrors, loginSchema } from "@/lib/auth/schemas";

export async function POST(request: Request) {
  if (!AUTH_AVAILABLE) return unavailable();
  const parsed = loginSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ errors: fieldErrors(parsed.error) }, { status: 400 });
  const { email } = parsed.data;
  const session = { name: email.split("@")[0], email, role: mockRoleFor(email) };
  await writeSession(session);
  return Response.json({ session });
}
