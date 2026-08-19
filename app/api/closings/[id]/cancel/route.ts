import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedAppUser } from "@/lib/auth/session";
import { ok, fail, httpStatus } from "@/lib/api/envelope";

const cancelSchema = z.object({
  reason: z.string().min(1, "Alasan pembatalan wajib diisi"),
});

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

  const body = await request.json().catch(() => null);
  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(fail("VALIDATION_ERROR", "reason wajib diisi"), {
      status: httpStatus("VALIDATION_ERROR"),
    });
  }

  // T-1 reverses this closing's bucket contribution on the linked
  // lead_report automatically (see supabase/migrations/009_trigger_sync_closing.sql).
  //
  // S0-02 (07-AUDIT-REPO.md): { count: "exact" } avoids RETURNING (which cs
  // fails RLS on outright), and cs is routed through v_closings_cs — a plain
  // UPDATE against the base `closings` table matches 0 rows for cs
  // regardless of RETURNING, because UPDATE needs row-level SELECT
  // visibility to find candidates at all and cs has none on the base table
  // by design. v_closings_cs is auto-updatable (migration 020), so this
  // reaches the table under the view's privileges instead. See
  // app/api/closings/[id]/route.ts for the full explanation.
  const table = appUser.role === "cs" ? "v_closings_cs" : "closings";
  const { error, count } = await supabase
    .from(table)
    .update(
      {
        payment_status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancel_reason: parsed.data.reason,
        updated_by: appUser.id,
      },
      { count: "exact" },
    )
    .eq("id", id);

  if (error) {
    if (error.message.includes("sudah dikunci")) {
      return NextResponse.json(fail("PERIOD_LOCKED", error.message), {
        status: httpStatus("PERIOD_LOCKED"),
      });
    }
    console.error("[api/closings/:id/cancel] POST", error);
    return NextResponse.json(fail("INTERNAL_ERROR"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }

  if (!count) {
    return NextResponse.json(fail("NOT_FOUND", "Closing tidak ditemukan"), {
      status: httpStatus("NOT_FOUND"),
    });
  }

  return NextResponse.json(ok({ id }));
}
