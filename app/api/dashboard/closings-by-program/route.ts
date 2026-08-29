import { NextResponse } from "next/server";
import { getAuthedAppUser } from "@/lib/auth/session";
import { hasOwnerAccess } from "@/lib/auth/roles";
import { ok, fail, httpStatus } from "@/lib/api/envelope";
import { todayJakarta } from "@/lib/utils/date";

/**
 * Jumlah closing per program — untuk melihat program mana yang paling banyak
 * closing. Hitung semua closing (owner boleh SELECT closings; RLS membatasi
 * brand). Terpisah dari metrik ad-funnel; ini murni cacah closing per program.
 */
export async function GET(request: Request) {
  const { user, appUser, supabase } = await getAuthedAppUser();
  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }
  if (!appUser || !hasOwnerAccess(appUser.role)) {
    return NextResponse.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? `${todayJakarta().slice(0, 7)}-01`;
  const to = searchParams.get("to") ?? todayJakarta();

  const [closingsRes, programsRes] = await Promise.all([
    supabase
      .from("closings")
      .select("program_id, total_value, payment_status, cancelled_at")
      .gte("closing_date", from)
      .lte("closing_date", to),
    supabase.from("programs").select("id, name"),
  ]);

  if (closingsRes.error || programsRes.error) {
    console.error("[api/dashboard/closings-by-program]", closingsRes.error ?? programsRes.error);
    return NextResponse.json(fail("INTERNAL_ERROR"), { status: httpStatus("INTERNAL_ERROR") });
  }

  const programName = new Map((programsRes.data ?? []).map((p) => [p.id, p.name]));
  const byProgram = new Map<string, { closing: number; omset: number }>();

  for (const c of closingsRes.data ?? []) {
    if (c.cancelled_at || c.payment_status === "cancelled") continue;
    const key = c.program_id ?? "unknown";
    const acc = byProgram.get(key) ?? { closing: 0, omset: 0 };
    acc.closing += 1;
    acc.omset += c.total_value ?? 0;
    byProgram.set(key, acc);
  }

  const rows = [...byProgram.entries()]
    .map(([id, v]) => ({
      program_id: id,
      program_name: programName.get(id) ?? "Program dihapus",
      closing: v.closing,
      omset: v.omset,
    }))
    .sort((a, b) => b.closing - a.closing);

  return NextResponse.json(ok(rows));
}
