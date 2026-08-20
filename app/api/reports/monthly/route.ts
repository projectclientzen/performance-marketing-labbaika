import { NextResponse } from "next/server";
import { getAuthedAppUser } from "@/lib/auth/session";
import { ok, fail, httpStatus } from "@/lib/api/envelope";
import { monthRange } from "@/lib/utils/date";

/**
 * Bundles Acquisition/Lead Quality/Sales/Profitability (from
 * get_dashboard_overview), Campaign Quality, and CS Performance for one
 * month — 02-PRD-v1.3.md §13. Lead Insight aggregation is not included:
 * that needs its own denominator-aware query (§6, §12) not built yet.
 */
export async function GET(request: Request) {
  const { user, appUser, supabase } = await getAuthedAppUser();
  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }
  if (!appUser || appUser.role !== "owner") {
    return NextResponse.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") ?? "", 10);
  const month = parseInt(searchParams.get("month") ?? "", 10);
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json(fail("VALIDATION_ERROR", "year dan month wajib diisi"), {
      status: httpStatus("VALIDATION_ERROR"),
    });
  }

  const { from, to } = monthRange(year, month);
  const attribution = searchParams.get("attribution") === "cohort" ? "cohort" : "cash";
  const source = searchParams.get("source");
  const campaign = searchParams.get("campaign");

  const [overview, campaigns, csPerformance] = await Promise.all([
    supabase
      .rpc("get_dashboard_overview", {
        p_brand_id: appUser.brand_id,
        p_from: from,
        p_to: to,
        p_attribution: attribution,
        p_source_id: source,
        p_campaign_id: campaign,
      })
      .single(),
    supabase.rpc("get_campaign_quality", {
      p_brand_id: appUser.brand_id,
      p_from: from,
      p_to: to,
      p_attribution: attribution,
    }),
    supabase.rpc("get_cs_performance", {
      p_brand_id: appUser.brand_id,
      p_from: from,
      p_to: to,
    }),
  ]);

  if (overview.error || campaigns.error || csPerformance.error) {
    console.error(
      "[api/reports/monthly] GET",
      overview.error ?? campaigns.error ?? csPerformance.error,
    );
    return NextResponse.json(fail("INTERNAL_ERROR"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }

  return NextResponse.json(
    ok({
      period: { year, month, from, to },
      overview: overview.data,
      campaigns: campaigns.data,
      cs_performance: csPerformance.data,
    }),
  );
}
