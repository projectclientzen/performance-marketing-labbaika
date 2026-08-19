import { NextResponse } from "next/server";
import { getAuthedAppUser } from "@/lib/auth/session";
import { ok, fail, httpStatus } from "@/lib/api/envelope";
import { leadReportPayloadSchema, leadReportPayloadSchemaCS } from "@/lib/schemas/report";

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

  const schema = appUser.role === "cs" ? leadReportPayloadSchemaCS : leadReportPayloadSchema;
  const parsed = schema.safeParse(rawBody);

  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join(".") || "body"] = issue.message;
    }
    return NextResponse.json(fail("VALIDATION_ERROR", undefined, fields), {
      status: httpStatus("VALIDATION_ERROR"),
    });
  }

  // cs always reports for themselves — a client-supplied cs_id is ignored.
  // owner may report on behalf of another cs (per 02-PRD-v1.3.md §4), and
  // must supply one since owner has no "own" reporting identity.
  const targetCsId = appUser.role === "cs" ? appUser.id : parsed.data.cs_id;
  if (!targetCsId) {
    return NextResponse.json(fail("VALIDATION_ERROR", "cs_id wajib diisi", { cs_id: "wajib" }), {
      status: httpStatus("VALIDATION_ERROR"),
    });
  }

  const idempotencyKey =
    typeof rawBody?.idempotency_key === "string" && rawBody.idempotency_key.length > 0
      ? rawBody.idempotency_key
      : null;

  const { data, error } = await supabase.rpc("create_lead_report_batch", {
    p_brand_id: appUser.brand_id,
    p_cs_id: targetCsId,
    p_report_date: parsed.data.date,
    p_blocks: parsed.data.blocks,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    if (error.message.includes("lead_reports_sum_check")) {
      return NextResponse.json(
        fail(
          "VALIDATION_ERROR",
          "Jumlah cold + consultation + offering harus sama dengan total lead",
        ),
        { status: httpStatus("VALIDATION_ERROR") },
      );
    }
    if (error.message.includes("sudah dikunci")) {
      return NextResponse.json(fail("PERIOD_LOCKED", error.message), {
        status: httpStatus("PERIOD_LOCKED"),
      });
    }
    return NextResponse.json(fail("INTERNAL_ERROR", error.message), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }

  return NextResponse.json(ok(data));
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
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const csParam = searchParams.get("cs");

  let query = supabase.from("lead_reports").select("*").order("report_date", { ascending: false });

  // RLS already scopes cs to their own rows; this filter is for owner
  // narrowing to one cs, or a cs redundantly filtering their own id.
  if (csParam) query = query.eq("cs_id", csParam);
  if (date) query = query.eq("report_date", date);
  if (from) query = query.gte("report_date", from);
  if (to) query = query.lte("report_date", to);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(fail("INTERNAL_ERROR", error.message), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }

  return NextResponse.json(ok(data));
}
