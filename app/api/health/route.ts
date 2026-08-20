import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/envelope";

/**
 * Verifies the Supabase connection is reachable. A PostgREST error (e.g.
 * "relation does not exist" before migrations run) still proves connectivity,
 * so only a network/config failure is reported as unhealthy.
 */
export async function GET() {
  const missingEnv = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ].filter((key) => !process.env[key]);

  if (missingEnv.length > 0) {
    return NextResponse.json(
      fail("INTERNAL_ERROR", `Env var belum diisi: ${missingEnv.join(", ")}`),
      { status: 503 },
    );
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("app_users").select("id").limit(1);

    return NextResponse.json(
      ok({
        status: "ok",
        supabase_reachable: true,
        query_error: error?.message ?? null,
      }),
    );
  } catch (err) {
    return NextResponse.json(
      fail(
        "INTERNAL_ERROR",
        err instanceof Error ? err.message : "Gagal terhubung ke Supabase",
      ),
      { status: 503 },
    );
  }
}
