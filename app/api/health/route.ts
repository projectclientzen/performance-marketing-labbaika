import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/envelope";

/**
 * Verifies the Supabase connection is reachable. A PostgREST error (e.g.
 * "relation does not exist" before migrations run) still proves connectivity,
 * so only a network/config failure is reported as unhealthy.
 */
export async function GET() {
  // URL + anon key dipatok di lib/supabase/config (publik), jadi tidak ada lagi
  // env NEXT_PUBLIC yang perlu dicek di sini — uji konektivitas di bawah yang
  // membuktikan keduanya benar.
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("app_users").select("id").limit(1);

    // Tidak meneruskan error.message maupun err.message ke klien: route ini
    // tidak diautentikasi (middleware melewati /api), jadi pesan mentah
    // Postgres di sini membocorkan nama tabel dan constraint ke siapa pun —
    // persis pola yang dibersihkan dari seluruh route lain (07-AUDIT-REPO.md
    // S1-04). Daftar env var yang kosong tetap disebutkan di atas: itu bukan
    // rahasia, dan justru nilai diagnostik utama endpoint ini.
    if (error) console.error("[api/health]", error);

    return NextResponse.json(
      ok({
        status: "ok",
        supabase_reachable: true,
        query_ok: !error,
      }),
    );
  } catch (err) {
    console.error("[api/health]", err);
    return NextResponse.json(fail("INTERNAL_ERROR", "Gagal terhubung ke Supabase"), {
      status: 503,
    });
  }
}
