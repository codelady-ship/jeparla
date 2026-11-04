"use client";

export type SendResult<T> =
  { ok: true; data: T } | { ok: false; status: number; errors: Record<string, string> };

/** JSON request to a cabinet route handler; network failures become { form: "network" }. */
export async function sendJson<T>(
  method: string,
  path: string,
  body: unknown,
): Promise<SendResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, errors: { form: "network" } };
  }
  const data = (await res.json().catch(() => ({}))) as T & { errors?: Record<string, string> };
  if (res.ok) return { ok: true, data };
  return {
    ok: false,
    status: res.status,
    errors: data.errors ?? {
      form: res.status === 401 ? "sessionExpired" : res.status === 503 ? "unavailable" : "server",
    },
  };
}
