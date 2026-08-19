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
  const { data, error } = await supabase
    .from("closings")
    .update({
      payment_status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancel_reason: parsed.data.reason,
      updated_by: appUser.id,
    })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    if (error.message.includes("sudah dikunci")) {
      return NextResponse.json(fail("PERIOD_LOCKED", error.message), {
        status: httpStatus("PERIOD_LOCKED"),
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
