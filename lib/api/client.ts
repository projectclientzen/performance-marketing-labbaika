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
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new ApiError(
      body.error?.message ?? `Request gagal (${res.status})`,
      body.error?.code,
      body.error?.fields,
    );
  }
  return body.data as T;
}
