import { NextResponse } from "next/server";
import { getAuthedAppUser } from "@/lib/auth/session";
import { hasOwnerAccess } from "@/lib/auth/roles";
import { ok, fail, httpStatus } from "@/lib/api/envelope";
import { todayJakarta } from "@/lib/utils/date";

/**
 * Jumlah closing per channel/source — SEMUA source, termasuk organik/"other"
 * yang tak tertaut lead iklan. SENGAJA terpisah dari metrik ad-funnel
 * (Overview ROI/CPP, Campaign Quality): mencampur closing organik ke sana akan
 * mendistorsi performa iklan. Gunanya justru sebaliknya — melihat channel non-
 * iklan yang sudah menghasilkan closing, untuk memutuskan mana yang layak
 * "diserang" dengan iklan.
 *
 * Dihitung di sini (bukan view SQL) supaya tidak menyentuh view analitik
 * sensitif; owner boleh SELECT closings langsung (RLS owner membatasi brand).
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

  const [closingsRes, sourcesRes] = await Promise.all([
    supabase
      .from("closings")
      .select("source_id, total_value, payment_status, cancelled_at")
      .gte("closing_date", from)
      .lte("closing_date", to),
    supabase.from("lead_sources").select("id, name"),
  ]);

  if (closingsRes.error || sourcesRes.error) {
    console.error("[api/dashboard/closings-by-channel]", closingsRes.error ?? sourcesRes.error);
    return NextResponse.json(fail("INTERNAL_ERROR"), { status: httpStatus("INTERNAL_ERROR") });
  }

  const sourceName = new Map((sourcesRes.data ?? []).map((s) => [s.id, s.name]));
  const byChannel = new Map<string, { closing: number; omset: number }>();

  for (const c of closingsRes.data ?? []) {
    // Closing sukses = belum dibatalkan.
    if (c.cancelled_at || c.payment_status === "cancelled") continue;
    const key = c.source_id ?? "other";
    const acc = byChannel.get(key) ?? { closing: 0, omset: 0 };
    acc.closing += 1;
    acc.omset += c.total_value ?? 0;
    byChannel.set(key, acc);
  }

  const rows = [...byChannel.entries()]
    .map(([id, v]) => ({
      source_id: id === "other" ? null : id,
      source_name: id === "other" ? "Lainnya" : sourceName.get(id) ?? "Lainnya",
      closing: v.closing,
      omset: v.omset,
    }))
    .sort((a, b) => b.closing - a.closing);

  return NextResponse.json(ok(rows));
}
