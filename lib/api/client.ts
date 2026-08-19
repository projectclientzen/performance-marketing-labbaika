/** Fetch wrapper for client components — unwraps the {data,error} envelope. */
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(body.error?.message ?? `Request gagal (${res.status})`);
  }
  return body.data as T;
}
