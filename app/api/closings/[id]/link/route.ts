import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedAppUser } from "@/lib/auth/session";
import { ok, fail, httpStatus } from "@/lib/api/envelope";

const linkSchema = z.object({
  lead_report_id: z.string().uuid(),
  previous_stage: z.enum(["cold", "consultation", "offering"]),
});

/** Reconciles an Unlinked Closing (02-PRD-v1.3.md §3.3 step 5) to a lead_report. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  if (appUser.role !== "owner") {
    return NextResponse.json(fail("FORBIDDEN", "Hanya Owner yang bisa menautkan closing"), {
      status: httpStatus("FORBIDDEN"),
    });
  }

  const body = await request.json().catch(() => null);
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(fail("VALIDATION_ERROR", "lead_report_id dan previous_stage wajib"), {
      status: httpStatus("VALIDATION_ERROR"),
    });
  }

  // T-1 applies the bucket effect on the newly-linked report (see
  // supabase/migrations/009_trigger_sync_closing.sql), including its own
  // STAGE_UNDERFLOW guard.
  const { data, error } = await supabase
    .from("closings")
    .update({
      lead_report_id: parsed.data.lead_report_id,
      previous_stage: parsed.data.previous_stage,
      updated_by: appUser.id,
    })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    if (error.message.includes("tidak cukup untuk dikurangi")) {
      return NextResponse.json(fail("STAGE_UNDERFLOW", error.message), {
        status: httpStatus("STAGE_UNDERFLOW"),
      });
    }
    return NextResponse.json(fail("INTERNAL_ERROR", error.message), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }

  if (!data) {
    return NextResponse.json(fail("NOT_FOUND", "Closing tidak ditemukan"), {
      status: httpStatus("NOT_FOUND"),
    });
  }

  return NextResponse.json(ok(data));
}
