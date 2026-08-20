import { NextResponse } from "next/server";
import { getAuthedAppUser } from "@/lib/auth/session";
import { hasOwnerAccess } from "@/lib/auth/roles";
import { ok, fail, httpStatus } from "@/lib/api/envelope";
import { closingSchema } from "@/lib/schemas/closing";
import { normalizePhoneID } from "@/lib/utils/phone";

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

  const rawBody = await request.json().catch(() => null);
  if (rawBody === null) {
    return NextResponse.json(fail("BAD_REQUEST", "Body bukan JSON valid"), {
      status: httpStatus("BAD_REQUEST"),
    });
  }

  const parsed = closingSchema.safeParse(rawBody);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join(".") || "body"] = issue.message;
    }
    return NextResponse.json(fail("VALIDATION_ERROR", undefined, fields), {
      status: httpStatus("VALIDATION_ERROR"),
    });
  }

  const force = rawBody.force === true;
  const whatsappE164 = normalizePhoneID(parsed.data.whatsapp);

  // Duplicate check is a soft, application-level rule (see migration 015):
  // the DB index backing this is intentionally NOT unique, because an
  // owner-confirmed duplicate (group booking, one PIC WhatsApp) must be
  // allowed to save. Only a hard DB constraint can't express "unless
  // force=true and caller is owner" — this can.
  const { data: conflict } = await supabase
    .from("closings")
    .select("id, closing_date, program_id, cs_id, app_users:cs_id(full_name), programs:program_id(name)")
    .eq("brand_id", appUser.brand_id)
    .eq("whatsapp_e164", whatsappE164 ?? "")
    .eq("departure_id", parsed.data.departure_id)
    .neq("payment_status", "cancelled")
    .maybeSingle();

  if (conflict && !(force && hasOwnerAccess(appUser.role))) {
    type ConflictRow = {
      closing_date: string;
      app_users: { full_name: string } | { full_name: string }[] | null;
      programs: { name: string } | { name: string }[] | null;
    };
    const row = conflict as unknown as ConflictRow;
    const csInfo = Array.isArray(row.app_users) ? row.app_users[0] : row.app_users;
    const programInfo = Array.isArray(row.programs) ? row.programs[0] : row.programs;

    return NextResponse.json(
      fail("DUPLICATE_CONFLICT", undefined, {
        cs_name: csInfo?.full_name ?? "-",
        closing_date: row.closing_date,
        program_name: programInfo?.name ?? "-",
      }),
      { status: httpStatus("DUPLICATE_CONFLICT") },
    );
  }

  // S0-02 (07-AUDIT-REPO.md): no .select() here. Supabase compiles
  // .insert().select() to INSERT ... RETURNING, which needs a SELECT
  // policy on the resulting row — cs deliberately has none on closings
  // (jalur baca cs adalah v_closings_cs), so every cs-initiated
  // closing failed outright with "new row violates row-level security
  // policy" before this fix. { count: "exact" } gets a row count from the
  // command tag instead, no RETURNING involved, no RLS SELECT check.
  const id = crypto.randomUUID();
  const { error, count } = await supabase
    .from("closings")
    .insert(
      {
        id,
        brand_id: appUser.brand_id,
        cs_id: appUser.id,
        first_name: parsed.data.first_name,
        last_name: parsed.data.last_name,
        whatsapp_raw: parsed.data.whatsapp,
        email: parsed.data.email,
        pdp_consent: parsed.data.pdp_consent,
        pdp_consent_at: parsed.data.pdp_consent_at,
        lead_date: parsed.data.lead_date,
        source_id: parsed.data.source_id,
        campaign_id: parsed.data.campaign_id,
        previous_stage: parsed.data.previous_stage,
        closing_date: parsed.data.closing_date,
        program_id: parsed.data.program_id,
        departure_id: parsed.data.departure_id,
        room_type: parsed.data.room_type,
        pax: parsed.data.pax,
        price_at_transaction: parsed.data.price_at_transaction,
        total_value: parsed.data.total_value,
        is_price_override: parsed.data.is_price_override,
        price_note: parsed.data.price_note,
        payment_status: parsed.data.payment_status,
        paid_amount: parsed.data.paid_amount,
        province_id: parsed.data.province_id,
        city_id: parsed.data.city_id,
        address: parsed.data.address,
        created_by: appUser.id,
        updated_by: appUser.id,
      },
      { count: "exact" },
    );

  if (error) {
    if (error.message.includes("Nomor WhatsApp tidak valid")) {
      return NextResponse.json(
        fail("VALIDATION_ERROR", "Nomor WhatsApp tidak valid", { whatsapp: error.message }),
        { status: httpStatus("VALIDATION_ERROR") },
      );
    }
    if (error.message.includes("sudah dikunci")) {
      return NextResponse.json(fail("PERIOD_LOCKED", error.message), {
        status: httpStatus("PERIOD_LOCKED"),
      });
    }
    if (error.message.includes("tidak cukup untuk dikurangi")) {
      return NextResponse.json(fail("STAGE_UNDERFLOW", error.message), {
        status: httpStatus("STAGE_UNDERFLOW"),
      });
    }
    console.error("[api/closings] POST", error);
    return NextResponse.json(fail("INTERNAL_ERROR"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }

  if (!count) {
    return NextResponse.json(fail("INTERNAL_ERROR", "Closing tidak tersimpan"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }

  return NextResponse.json(ok({ id }));
}

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

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const csParam = searchParams.get("cs");
  const programParam = searchParams.get("program");
  const status = searchParams.get("status");

  // cs has no SELECT policy on the base table at all (CC-B13) — reads
  // through v_closings_cs, which never exposes cost/profit columns.
  const table = appUser.role === "cs" ? "v_closings_cs" : "closings";
  let query = supabase.from(table).select("*").order("closing_date", { ascending: false });

  if (csParam) query = query.eq("cs_id", csParam);
  if (programParam) query = query.eq("program_id", programParam);
  if (status) query = query.eq("payment_status", status);
  if (from) query = query.gte("closing_date", from);
  if (to) query = query.lte("closing_date", to);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(fail("INTERNAL_ERROR", error.message), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }

  return NextResponse.json(ok(data));
}
