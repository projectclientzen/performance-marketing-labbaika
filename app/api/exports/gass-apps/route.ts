import { NextResponse } from "next/server";
import { getAuthedAppUser } from "@/lib/auth/session";
import { hasOwnerAccess } from "@/lib/auth/roles";
import { ok, fail, httpStatus } from "@/lib/api/envelope";
import { toCSV } from "@/lib/utils/csv";

const PAGE_SIZE = 1000;

/**
 * F-13 Export Gass Apps. Unlike the other two exports (operational,
 * meta-ltv), the prototype shows this as copy-to-clipboard, not a file
 * download — "cukup salin, tidak diunduh jadi file" — so this returns the
 * CSV text in the normal {data} envelope instead of streaming a file
 * response. Same pagination-loop shape as the others internally (021),
 * just accumulated into one string instead of written to a ReadableStream,
 * since there's no download to keep memory-flat for.
 *
 * Route re-checks hasOwnerAccess itself rather than relying on the SQL
 * guard alone — same two-layer pattern as every other export route.
 */
export async function POST(request: Request) {
  const { user, appUser, supabase } = await getAuthedAppUser();
  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }
  if (!appUser) {
    return NextResponse.json(fail("NOT_FOUND", "Profil pengguna tidak ditemukan"), {
      status: httpStatus("NOT_FOUND"),
    });
  }
  if (!hasOwnerAccess(appUser.role)) {
    return NextResponse.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }

  const body = await request.json().catch(() => ({}));
  const from: string | undefined = body.from;
  const to: string | undefined = body.to;

  const rows: { id: string; phone: string; cs_whatsapp: string | null; value: number }[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.rpc("get_export_gass_apps", {
      p_brand_id: appUser.brand_id,
      p_from: from ?? null,
      p_to: to ?? null,
      p_offset: offset,
      p_limit: PAGE_SIZE,
    });
    if (error) {
      console.error("[api/exports/gass-apps]", error);
      return NextResponse.json(fail("INTERNAL_ERROR"), {
        status: httpStatus("INTERNAL_ERROR"),
      });
    }
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  // cs_whatsapp can be null — app_users.whatsapp (027) isn't backfilled for
  // any existing CS yet. Rows aren't dropped for it (the closing data is
  // still correct), but the count is surfaced so the owner isn't left
  // guessing why some rows have an empty CS Phone Number column.
  const missingCsPhone = rows.filter((r) => !r.cs_whatsapp).length;

  const csv = toCSV(
    ["ID", "Phone Number", "CS Phone Number", "Value"],
    rows.map((r) => [r.id, r.phone, r.cs_whatsapp ?? "", r.value]),
  );

  return NextResponse.json(ok({ csv, row_count: rows.length, missing_cs_phone: missingCsPhone }));
}
