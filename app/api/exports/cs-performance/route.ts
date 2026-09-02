import { getAuthedAppUser } from "@/lib/auth/session";
import { hasOwnerAccess } from "@/lib/auth/roles";
import { fail, httpStatus } from "@/lib/api/envelope";
import { toCSV } from "@/lib/utils/csv";

/**
 * Export Performa CS — meniru layout laporan harian yang diisi CS: satu baris
 * per CS per hari, kolom lead dipecah per sumber (Facebook LP, Facebook CTWA,
 * Google, dst) lalu kolom status corong (No Respon, Konsul, Penawaran,
 * Closing). Dipakai owner untuk laporan bulanan, bisa difilter satu CS.
 *
 * Sumber datanya lead_reports: satu baris per (cs, tanggal, source, campaign).
 * total_lead per baris = jumlah lead sumber itu; kolom sumber = pivot total_lead
 * per source_id. Status (cold/consultation/offering/closing) dijumlah lintas
 * sumber untuk hari itu — persis seperti sheet, di mana status adalah corong
 * gabungan hari itu, bukan per channel.
 *
 * Iklan sengaja tidak di sini: ad_performance grain-nya per campaign, tidak
 * bisa diatribusikan ke CS.
 *
 * Volume bulanan kecil (≈ hari × cs × source), jadi diagregasi di memori.
 */
export async function POST(request: Request) {
  const { user, appUser, supabase } = await getAuthedAppUser();
  if (!user) {
    return Response.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }
  if (!appUser) {
    return Response.json(fail("NOT_FOUND", "Profil pengguna tidak ditemukan"), {
      status: httpStatus("NOT_FOUND"),
    });
  }
  if (!hasOwnerAccess(appUser.role)) {
    return Response.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }

  const body = await request.json().catch(() => ({}));
  const from: string | undefined = body.from;
  const to: string | undefined = body.to;
  const csId: string | undefined = body.cs;

  // Kolom sumber: urut sort_order, jadi header stabil dan sesuai urutan sheet.
  const { data: sources } = await supabase
    .from("lead_sources")
    .select("id, name, sort_order")
    .eq("brand_id", appUser.brand_id)
    .order("sort_order");
  const sourceList = (sources ?? []) as { id: string; name: string; sort_order: number }[];

  let query = supabase
    .from("lead_reports")
    .select("cs_id, report_date, source_id, total_lead, cold, consultation, offering, closing")
    .eq("brand_id", appUser.brand_id);

  if (from) query = query.gte("report_date", from);
  if (to) query = query.lte("report_date", to);
  if (csId) query = query.eq("cs_id", csId);

  const { data, error } = await query;
  if (error) {
    console.error("[api/exports/cs-performance]", error);
    return Response.json(fail("INTERNAL_ERROR", "Export gagal"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }

  const { data: users } = await supabase.from("app_users").select("id, full_name");
  const nameById = new Map((users ?? []).map((u: { id: string; full_name: string }) => [u.id, u.full_name]));

  type Row = {
    cs_id: string;
    report_date: string;
    source_id: string;
    total_lead: number;
    cold: number;
    consultation: number;
    offering: number;
    closing: number;
  };

  type Bucket = {
    cs_id: string;
    report_date: string;
    bySource: Map<string, number>; // source_id -> total_lead
    cold: number;
    consultation: number;
    offering: number;
    closing: number;
  };

  // Agregasi per (cs_id, report_date): lead per sumber + status gabungan.
  const buckets = new Map<string, Bucket>();
  for (const r of (data ?? []) as Row[]) {
    const key = `${r.cs_id}|${r.report_date}`;
    const b: Bucket =
      buckets.get(key) ?? {
        cs_id: r.cs_id,
        report_date: r.report_date,
        bySource: new Map(),
        cold: 0,
        consultation: 0,
        offering: 0,
        closing: 0,
      };
    b.bySource.set(r.source_id, (b.bySource.get(r.source_id) ?? 0) + r.total_lead);
    b.cold += r.cold;
    b.consultation += r.consultation;
    b.offering += r.offering;
    b.closing += r.closing;
    buckets.set(key, b);
  }

  const sorted = Array.from(buckets.values()).sort((a, b) => {
    const na = nameById.get(a.cs_id) ?? "";
    const nb = nameById.get(b.cs_id) ?? "";
    if (na !== nb) return na.localeCompare(nb);
    return a.report_date.localeCompare(b.report_date);
  });

  const headers = [
    "Tanggal",
    "CS",
    ...sourceList.map((s) => s.name),
    "Total Leads",
    "No Respon",
    "Konsul",
    "Penawaran",
    "Closing",
  ];
  const rows = sorted.map((b) => {
    const sourceCells = sourceList.map((s) => b.bySource.get(s.id) ?? 0);
    const totalLeads = sourceCells.reduce((sum, n) => sum + n, 0);
    return [
      b.report_date,
      nameById.get(b.cs_id) ?? "-",
      ...sourceCells,
      totalLeads,
      b.cold,
      b.consultation,
      b.offering,
      b.closing,
    ];
  });

  const csv = toCSV(headers, rows, { bom: true });

  await supabase.from("export_logs").insert({
    brand_id: appUser.brand_id,
    user_id: appUser.id,
    export_type: "cs_performance",
    filters: { from, to, cs: csId ?? null },
    row_count: rows.length,
  });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="performa-cs-${from ?? "all"}-${to ?? "all"}.csv"`,
    },
  });
}
