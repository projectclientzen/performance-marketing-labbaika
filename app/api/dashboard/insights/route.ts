import { NextResponse } from "next/server";
import { getAuthedAppUser } from "@/lib/auth/session";
import { ok, fail, httpStatus } from "@/lib/api/envelope";
import { todayJakarta } from "@/lib/utils/date";

export async function GET(request: Request) {
  const { user, appUser, supabase } = await getAuthedAppUser();
  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }
  if (!appUser || appUser.role !== "owner") {
    return NextResponse.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? `${todayJakarta().slice(0, 7)}-01`;
  const to = searchParams.get("to") ?? todayJakarta();

  const { data, error } = await supabase.rpc("get_lead_insight_summary", {
    p_brand_id: appUser.brand_id,
    p_from: from,
    p_to: to,
  });

  if (error) {
    console.error("[api/dashboard/insights]", error);
    return NextResponse.json(fail("INTERNAL_ERROR"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }
  return NextResponse.json(ok(data));
}
