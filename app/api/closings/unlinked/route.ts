import { NextResponse } from "next/server";
import { getAuthedAppUser } from "@/lib/auth/session";
import { ok, fail, httpStatus } from "@/lib/api/envelope";

/** Owner's Reconciliation panel (02-PRD-v1.3.md §10E). */
export async function GET() {
  const { user, appUser, supabase } = await getAuthedAppUser();

  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }
  if (!appUser) {
    return NextResponse.json(fail("NOT_FOUND", "Profil pengguna tidak ditemukan"), {
      status: httpStatus("NOT_FOUND"),
    });
  }
  if (appUser.role !== "owner") {
    return NextResponse.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }

  const { data, error } = await supabase
    .from("closings")
    .select("*")
    .is("lead_report_id", null)
    .neq("payment_status", "cancelled")
    .order("closing_date", { ascending: false });

  if (error) {
    return NextResponse.json(fail("INTERNAL_ERROR", error.message), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }

  return NextResponse.json(ok(data));
}
