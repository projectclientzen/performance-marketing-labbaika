import { NextResponse } from "next/server";
import { getAuthedAppUser } from "@/lib/auth/session";
import { hasOwnerAccess } from "@/lib/auth/roles";
import { ok, fail, httpStatus } from "@/lib/api/envelope";
import { todayJakarta } from "@/lib/utils/date";

/**
 * Pembagian closing: via paid traffic vs organik/other. Klasifikasi = apakah
 * closing tertaut campaign iklan (campaign_id). Berbeda dari metrik ad-funnel
 * yang lain, ini menghitung SEMUA closing (owner boleh SELECT closings; RLS
 * membatasi brand) hanya untuk membaginya — tidak memengaruhi ROI/CPP iklan.
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

  const { data, error } = await supabase
    .from("closings")
    .select("campaign_id, total_value, payment_status, cancelled_at")
    .gte("closing_date", from)
    .lte("closing_date", to);

  if (error) {
    console.error("[api/dashboard/closing-source-split]", error);
    return NextResponse.json(fail("INTERNAL_ERROR"), { status: httpStatus("INTERNAL_ERROR") });
  }

  let paid = 0;
  let other = 0;
  let paidOmset = 0;
  let otherOmset = 0;
  for (const c of data ?? []) {
    if (c.cancelled_at || c.payment_status === "cancelled") continue;
    if (c.campaign_id) {
      paid += 1;
      paidOmset += c.total_value ?? 0;
    } else {
      other += 1;
      otherOmset += c.total_value ?? 0;
    }
  }

  return NextResponse.json(ok({ paid, other, paid_omset: paidOmset, other_omset: otherOmset }));
}
