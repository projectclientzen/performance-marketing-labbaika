import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedAppUser } from "@/lib/auth/session";
import { ok, fail, httpStatus } from "@/lib/api/envelope";

/**
 * Accepts pre-parsed rows (client parses the CSV and sends structured
 * JSON) rather than a multipart file upload — simplified given time
 * budget; the brief's "upload CSV + preview mapping" UI (F-16) isn't
 * built, only this ingestion endpoint.
 *
 * Upsert is idempotent per (level, entity_id, date) via ad_performance's
 * unique index (migration 005). entity_id is resolved from external_id,
 * auto-creating a stub campaign/adset/ad/account row if none exists yet —
 * an import shouldn't require every entity to be pre-registered.
 */
const rowSchema = z.object({
  external_id: z.string().min(1),
  name: z.string().optional(),
  date: z.string().date(),
  spend: z.number().nonnegative().default(0),
  impressions: z.number().nonnegative().default(0),
  reach: z.number().nonnegative().default(0),
  clicks: z.number().nonnegative().default(0),
  leads: z.number().nonnegative().default(0),
});

const importSchema = z.object({
  level: z.enum(["account", "campaign", "adset", "ad"]),
  ad_account_external_id: z.string().optional(),
  ad_campaign_external_id: z.string().optional(),
  ad_set_external_id: z.string().optional(),
  rows: z.array(rowSchema).min(1),
});

const LEVEL_TABLE: Record<string, string> = {
  account: "ad_accounts",
  campaign: "ad_campaigns",
  adset: "ad_sets",
  ad: "ads",
};

export async function POST(request: Request) {
  const { user, appUser, supabase } = await getAuthedAppUser();
  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }
  if (!appUser || appUser.role !== "owner") {
    return NextResponse.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }

  const body = await request.json().catch(() => null);
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Format import tidak valid"), {
      status: httpStatus("VALIDATION_ERROR"),
    });
  }

  const table = LEVEL_TABLE[parsed.data.level];
  const rowsInserted: unknown[] = [];
  const errors: string[] = [];

  for (const row of parsed.data.rows) {
    let query = supabase.from(table).select("id").eq("brand_id", appUser.brand_id).eq("external_id", row.external_id);
    if (parsed.data.level === "campaign" && parsed.data.ad_account_external_id) {
      const { data: acc } = await supabase
        .from("ad_accounts")
        .select("id")
        .eq("brand_id", appUser.brand_id)
        .eq("external_id", parsed.data.ad_account_external_id)
        .maybeSingle();
      if (!acc) {
        errors.push(`ad_account ${parsed.data.ad_account_external_id} tidak ditemukan untuk campaign ${row.external_id}`);
        continue;
      }
    }

    const { data: existing } = await query.maybeSingle();
    let entityId = existing?.id as string | undefined;

    if (!entityId) {
      const insertPayload: Record<string, unknown> = {
        brand_id: appUser.brand_id,
        external_id: row.external_id,
        name: row.name ?? row.external_id,
      };
      if (parsed.data.level === "campaign") {
        const { data: acc } = await supabase
          .from("ad_accounts")
          .select("id")
          .eq("brand_id", appUser.brand_id)
          .eq("external_id", parsed.data.ad_account_external_id ?? "")
          .maybeSingle();
        insertPayload.ad_account_id = acc?.id;
      } else if (parsed.data.level === "adset") {
        const { data: camp } = await supabase
          .from("ad_campaigns")
          .select("id")
          .eq("brand_id", appUser.brand_id)
          .eq("external_id", parsed.data.ad_campaign_external_id ?? "")
          .maybeSingle();
        insertPayload.ad_campaign_id = camp?.id;
      } else if (parsed.data.level === "ad") {
        const { data: set } = await supabase
          .from("ad_sets")
          .select("id")
          .eq("brand_id", appUser.brand_id)
          .eq("external_id", parsed.data.ad_set_external_id ?? "")
          .maybeSingle();
        insertPayload.ad_set_id = set?.id;
      }

      const { data: created, error: createError } = await supabase
        .from(table)
        .insert(insertPayload)
        .select("id")
        .single();
      if (createError || !created) {
        errors.push(`Gagal membuat ${parsed.data.level} ${row.external_id}: ${createError?.message}`);
        continue;
      }
      entityId = created.id;
    }

    const { error: upsertError } = await supabase.from("ad_performance").upsert(
      {
        brand_id: appUser.brand_id,
        level: parsed.data.level,
        entity_id: entityId,
        date: row.date,
        spend: row.spend,
        impressions: row.impressions,
        reach: row.reach,
        clicks: row.clicks,
        leads: row.leads,
      },
      { onConflict: "brand_id,level,entity_id,date" },
    );

    if (upsertError) {
      errors.push(`${row.external_id} (${row.date}): ${upsertError.message}`);
    } else {
      rowsInserted.push({ external_id: row.external_id, date: row.date });
    }
  }

  await supabase.from("sync_logs").insert({
    brand_id: appUser.brand_id,
    source: "csv_import",
    status: errors.length === 0 ? "success" : "partial",
    message: errors.length > 0 ? errors.join("; ") : null,
  });

  return NextResponse.json(ok({ imported: rowsInserted.length, errors }));
}
