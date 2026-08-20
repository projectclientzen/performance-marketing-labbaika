import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedAppUser } from "@/lib/auth/session";
import { ok, fail, httpStatus } from "@/lib/api/envelope";

const insightSchema = z.object({
  stage: z.enum(["cold", "consultation", "offering", "closing"]),
  category_id: z.string().uuid(),
  lead_count: z.number().int().nonnegative(),
  note: z.string().optional(),
});

const putSchema = z.object({
  insights: z.array(insightSchema),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, supabase } = await getAuthedAppUser();

  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }

  const { data, error } = await supabase
    .from("lead_report_insights")
    .select("*")
    .eq("lead_report_id", id);

  if (error) {
    console.error("[api/lead-reports/[id]/insights]", error);
    return NextResponse.json(fail("INTERNAL_ERROR"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }

  return NextResponse.json(ok(data));
}

/**
 * Replace-all per stage, so the client never has to diff against the
 * server's current state (04-BRIEF-BE.md §6). Deletes existing rows for
 * every stage present in the payload, then inserts the new set — both
 * within one request, so a mid-write failure can't leave a stage half
 * updated relative to what the client thinks it sent.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, appUser, supabase } = await getAuthedAppUser();

  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }
  if (!appUser) {
    return NextResponse.json(fail("NOT_FOUND", "Profil pengguna tidak ditemukan"), {
      status: httpStatus("NOT_FOUND"),
    });
  }

  const body = await request.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Format insights tidak valid"), {
      status: httpStatus("VALIDATION_ERROR"),
    });
  }

  const stages = [...new Set(parsed.data.insights.map((i) => i.stage))];

  if (stages.length > 0) {
    const { error: deleteError } = await supabase
      .from("lead_report_insights")
      .delete()
      .eq("lead_report_id", id)
      .in("stage", stages);

    if (deleteError) {
      return NextResponse.json(fail("INTERNAL_ERROR", deleteError.message), {
        status: httpStatus("INTERNAL_ERROR"),
      });
    }
  }

  if (parsed.data.insights.length === 0) {
    return NextResponse.json(ok([]));
  }

  const { data, error } = await supabase
    .from("lead_report_insights")
    .insert(
      parsed.data.insights.map((i) => ({
        brand_id: appUser.brand_id,
        lead_report_id: id,
        stage: i.stage,
        category_id: i.category_id,
        lead_count: i.lead_count,
        note: i.note,
      })),
    )
    .select();

  if (error) {
    if (error.message.includes("melebihi jumlah lead")) {
      return NextResponse.json(fail("VALIDATION_ERROR", error.message), {
        status: httpStatus("VALIDATION_ERROR"),
      });
    }
    console.error("[api/lead-reports/[id]/insights]", error);
    return NextResponse.json(fail("INTERNAL_ERROR"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }

  return NextResponse.json(ok(data));
}
