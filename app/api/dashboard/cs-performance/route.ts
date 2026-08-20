import { NextResponse } from "next/server";
import { getAuthedAppUser } from "@/lib/auth/session";
import { ok, fail, httpStatus } from "@/lib/api/envelope";
import { todayJakarta } from "@/lib/utils/date";

/** Owner sees every cs; cs sees only their own row (02-PRD-v1.3.md §12). */
export async function GET(request: Request) {
  const { user, appUser, supabase } = await getAuthedAppUser();
  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }
  if (!appUser) {
    return NextResponse.json(fail("NOT_FOUND", "Profil pengguna tidak ditemukan"), {
      status: httpStatus("NOT_FOUND"),
    });
  }

  const { searchParams } = new URL(request.url);
  const today = todayJakarta();
  const from = searchParams.get("from") ?? `${today.slice(0, 7)}-01`;
  const to = searchParams.get("to") ?? today;

  const { data, error } = await supabase.rpc("get_cs_performance", {
    p_brand_id: appUser.brand_id,
    p_from: from,
    p_to: to,
  });

  if (error) {
    return NextResponse.json(fail("INTERNAL_ERROR", error.message), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }

  // Sejak migrasi 023 penyaringan per-cs dilakukan DI DALAM get_cs_performance,
  // bukan di sini: filter TypeScript bukan batas keamanan ketika RPC-nya bisa
  // dipanggil langsung dari browser dengan anon key (10-AUDIT-FE-BE.md #20b).
  // Baris ini dipertahankan sebagai lapis kedua, bukan sebagai penjaga utama.
  const rows = (data ?? []) as { cs_id: string }[];
  const scoped = appUser.role === "cs" ? rows.filter((r) => r.cs_id === appUser.id) : rows;

  return NextResponse.json(ok(scoped));
}
