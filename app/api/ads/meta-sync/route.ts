import { NextResponse } from "next/server";
import { getAuthedAppUser } from "@/lib/auth/session";
import { hasOwnerAccess } from "@/lib/auth/roles";
import { ok, fail, httpStatus } from "@/lib/api/envelope";

/**
 * F-16 — Meta Marketing API sync.
 *
 * Fetches campaign-level insights from Meta API for act_2631246970383085,
 * upserts to ad_campaigns + ad_performance.
 *
 * GET /api/ads/meta-sync?from=2026-08-01&to=2026-08-31
 */

const META_TOKEN = process.env.META_ACCESS_TOKEN!;
const META_ACCOUNT = "act_2631246970383085";
const META_API = "https://graph.facebook.com/v21.0";

interface MetaInsight {
  campaign_id: string;
  campaign_name: string;
  spend: string;
  impressions: string;
  reach: string;
  clicks: string;
  actions?: Array<{ action_type: string; value: string }>;
  date_start: string;
}

export async function GET(request: Request) {
  const { user, appUser, supabase } = await getAuthedAppUser();
  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }
  if (!appUser || !hasOwnerAccess(appUser.role)) {
    return NextResponse.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }

  const { searchParams } = new URL(request.url);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
  const from = searchParams.get("from") ?? `${today.slice(0, 7)}-01`;
  const to = searchParams.get("to") ?? today;

  // 1. Fetch insights from Meta API
  const fields = "campaign_id,campaign_name,spend,impressions,reach,clicks,actions,date_start";
  const metaUrl = `${META_API}/${META_ACCOUNT}/insights?level=campaign&fields=${fields}&time_range=${JSON.stringify({ since: from, until: to })}&access_token=${META_TOKEN}`;

  let insights: MetaInsight[];
  try {
    const metaRes = await fetch(metaUrl);
    const metaJson = await metaRes.json();
    if (metaJson.error) {
      return NextResponse.json(fail("VALIDATION_ERROR", metaJson.error.message), {
        status: httpStatus("BAD_REQUEST"),
      });
    }
    insights = metaJson.data ?? [];
  } catch (e) {
    return NextResponse.json(fail("VALIDATION_ERROR", String(e)), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }

  if (insights.length === 0) {
    return NextResponse.json(ok({ synced: 0, campaigns: 0, message: "Tidak ada data di Meta API untuk rentang ini" }));
  }

  // 2. Ensure ad_account exists
  const brandId = appUser.brand_id;
  let { data: account } = await supabase
    .from("ad_accounts")
    .select("id")
    .eq("brand_id", brandId)
    .eq("external_id", META_ACCOUNT)
    .maybeSingle();

  if (!account) {
    const { data: newAcc } = await supabase
      .from("ad_accounts")
      .insert({ brand_id: brandId, external_id: META_ACCOUNT, name: "Labbaika Meta Account" })
      .select("id")
      .single();
    account = newAcc;
  }

  if (!account) {
    return NextResponse.json(fail("INTERNAL_ERROR", "Gagal membuat ad_account"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }

  // 3. Upsert campaigns + performance
  let synced = 0;
  const campaignIds = new Set<string>();

  for (const insight of insights) {
    const campaignExtId = insight.campaign_id;
    campaignIds.add(campaignExtId);

    // Upsert campaign
    let { data: campaign } = await supabase
      .from("ad_campaigns")
      .select("id")
      .eq("brand_id", brandId)
      .eq("external_id", campaignExtId)
      .maybeSingle();

    if (!campaign) {
      const { data: newCamp } = await supabase
        .from("ad_campaigns")
        .insert({
          brand_id: brandId,
          ad_account_id: account.id,
          external_id: campaignExtId,
          name: insight.campaign_name,
        })
        .select("id")
        .single();
      campaign = newCamp;
    }

    if (!campaign) continue;

    // Count leads from actions
    const leadAction = insight.actions?.find(
      (a) => a.action_type === "offsite_conversion.fb_pixel_lead" || a.action_type === "lead",
    );
    const leads = leadAction ? parseInt(leadAction.value, 10) || 0 : 0;

    // Upsert performance
    const { error } = await supabase.from("ad_performance").upsert(
      {
        brand_id: brandId,
        level: "campaign" as const,
        entity_id: campaign.id,
        date: insight.date_start,
        spend: Math.round(parseFloat(insight.spend) || 0),
        impressions: Math.round(parseFloat(insight.impressions) || 0),
        reach: Math.round(parseFloat(insight.reach) || 0),
        clicks: Math.round(parseFloat(insight.clicks) || 0),
        leads,
      },
      { onConflict: "brand_id,level,entity_id,date" },
    );

    if (!error) synced++;
  }

  return NextResponse.json(
    ok({
      synced,
      campaigns: campaignIds.size,
      dateRange: { from, to },
      message: `Sync ${synced} data points dari ${campaignIds.size} campaign`,
    }),
  );
}
