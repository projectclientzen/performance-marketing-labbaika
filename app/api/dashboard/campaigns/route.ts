import { NextResponse } from "next/server";
import { getAuthedAppUser } from "@/lib/auth/session";
import { ok, fail, httpStatus } from "@/lib/api/envelope";
import { todayJakarta } from "@/lib/utils/date";

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
  if (appUser.role !== "owner") {
    return NextResponse.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }

  const { searchParams } = new URL(request.url);
  const today = todayJakarta();
  const from = searchParams.get("from") ?? `${today.slice(0, 7)}-01`;
  const to = searchParams.get("to") ?? today;
  const attribution = searchParams.get("attribution") === "cash" ? "cash" : "cohort";

  const { data, error } = await supabase.rpc("get_campaign_quality", {
    p_brand_id: appUser.brand_id,
    p_from: from,
    p_to: to,
    p_attribution: attribution,
  });

  if (error) {
    return NextResponse.json(fail("INTERNAL_ERROR", error.message), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }

  return NextResponse.json(ok(data, { attribution_mode: attribution }));
}
