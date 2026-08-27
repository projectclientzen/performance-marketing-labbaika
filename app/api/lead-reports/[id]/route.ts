import { NextResponse } from "next/server";
import { hasOwnerAccess } from "@/lib/auth/roles";
import { z } from "zod";
import { getAuthedAppUser } from "@/lib/auth/session";
import { ok, fail, httpStatus } from "@/lib/api/envelope";

const patchSchema = z.object({
  cold: z.number().int().nonnegative().optional(),
  consultation: z.number().int().nonnegative().optional(),
  offering: z.number().int().nonnegative().optional(),
  total_lead: z.number().int().nonnegative().optional(),
});

// 10-AUDIT-FE-BE.md #10: without this, the edit form (app/cs/laporan)
// has no way to load a past report's values before letting the cs
// correct them. RLS scopes rows the same way PATCH already does — a cs's
// own client only ever sees their own report, owner sees every report in
// their brand.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, supabase } = await getAuthedAppUser();

  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }

  const { data, error } = await supabase.from("lead_reports").select("*").eq("id", id).maybeSingle();

  if (error) {
    console.error("[api/lead-reports/[id]] GET", error);
    return NextResponse.json(fail("INTERNAL_ERROR"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }
  if (!data) {
    return NextResponse.json(fail("NOT_FOUND", "Laporan tidak ditemukan"), {
      status: httpStatus("NOT_FOUND"),
    });
  }

  return NextResponse.json(ok(data));
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, appUser, supabase } = await getAuthedAppUser();

  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }
  if (!appUser) {
    return NextResponse.json(fail("NOT_FOUND", "Profil pengguna tidak ditemukan"), { status: httpStatus("NOT_FOUND") });
  }

  // Check period lock
  const { data: report } = await supabase.from("lead_reports").select("id, report_date").eq("id", id).maybeSingle();
  if (!report) {
    return NextResponse.json(fail("NOT_FOUND", "Laporan tidak ditemukan"), { status: httpStatus("NOT_FOUND") });
  }

  const month = report.report_date.slice(0, 7);
  const { data: lock } = await supabase.from("period_locks").select("locked").eq("brand_id", appUser.brand_id).eq("month", month).maybeSingle();
  if (lock?.locked && !hasOwnerAccess(appUser.role)) {
    return NextResponse.json(fail("PERIOD_LOCKED", "Periode sudah dikunci"), { status: httpStatus("PERIOD_LOCKED") });
  }

  // .select() supaya kita tahu baris benar-benar terhapus. Tanpa ini, kalau
  // RLS memblokir diam-diam (mis. CS tanpa policy delete), delete mengenai 0
  // baris tanpa error dan UI mengira berhasil — laporannya muncul lagi saat
  // refresh.
  const { data: removed, error } = await supabase
    .from("lead_reports")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("[api/lead-reports/[id]] DELETE", error);
    const punyaRelasi = /foreign key|violates|referenced|constraint/i.test(error.message);
    return NextResponse.json(
      fail(
        punyaRelasi ? "CONFLICT" : "INTERNAL_ERROR",
        punyaRelasi
          ? "Laporan ini sudah dipakai (closing/insight terkait), jadi tidak bisa dihapus."
          : undefined,
      ),
      { status: httpStatus(punyaRelasi ? "CONFLICT" : "INTERNAL_ERROR") },
    );
  }

  if (!removed || removed.length === 0) {
    return NextResponse.json(fail("FORBIDDEN", "Tidak bisa menghapus laporan ini"), {
      status: httpStatus("FORBIDDEN"),
    });
  }

  return NextResponse.json(ok({ deleted: true }));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, appUser, supabase } = await getAuthedAppUser();

  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }
  if (!appUser) {
    return NextResponse.json(fail("NOT_FOUND", "Profil pengguna tidak ditemukan"), {
      status: httpStatus("NOT_FOUND"),
    });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join(".") || "body"] = issue.message;
    }
    return NextResponse.json(fail("VALIDATION_ERROR", undefined, fields), {
      status: httpStatus("VALIDATION_ERROR"),
    });
  }

  // RLS scopes this to the caller's own report (cs) or any report in their
  // brand (owner); the period-lock trigger (T-4) rejects a locked month for
  // non-owners with its own message, surfaced below.
  const { data, error } = await supabase
    .from("lead_reports")
    .update({ ...parsed.data, updated_by: appUser.id })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    if (error.message.includes("sudah dikunci")) {
      return NextResponse.json(fail("PERIOD_LOCKED", error.message), {
        status: httpStatus("PERIOD_LOCKED"),
      });
    }
    if (error.message.includes("lead_reports_sum_check")) {
      return NextResponse.json(
        fail("VALIDATION_ERROR", "Jumlah stage harus sama dengan total lead"),
        { status: httpStatus("VALIDATION_ERROR") },
      );
    }
    if (error.message.includes("tidak bisa diubah")) {
      return NextResponse.json(fail("VALIDATION_ERROR", error.message), {
        status: httpStatus("VALIDATION_ERROR"),
      });
    }
    console.error("[api/lead-reports/[id]]", error);
    return NextResponse.json(fail("INTERNAL_ERROR"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }

  if (!data) {
    return NextResponse.json(fail("NOT_FOUND", "Laporan tidak ditemukan"), {
      status: httpStatus("NOT_FOUND"),
    });
  }

  return NextResponse.json(ok(data));
}
