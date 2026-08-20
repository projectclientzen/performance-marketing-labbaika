export class ApiError extends Error {
  code?: string;
  fields?: Record<string, string>;
  constructor(message: string, code?: string, fields?: Record<string, string>) {
    super(message);
    this.code = code;
    this.fields = fields;
  }
}

/** Fetch wrapper for client components — unwraps the {data,error} envelope. */
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  // A 500/502/504 from a crashed runtime, gateway error, or platform
  // timeout can have an empty or non-JSON body — res.json() throws a raw
  // SyntaxError in that case instead of the ApiError callers already
  // handle, which (in a caller with no try/catch) surfaces as a stuck
  // loading state rather than a shown error.
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.error) {
    throw new ApiError(
      body?.error?.message ?? `Request gagal (${res.status})`,
      body?.error?.code,
      body?.error?.fields,
    );
  }
  return body.data as T;
}
