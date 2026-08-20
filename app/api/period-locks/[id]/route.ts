import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedAppUser } from "@/lib/auth/session";
import { ok, fail, httpStatus } from "@/lib/api/envelope";

const unlockSchema = z.object({
  reason: z.string().min(1, "Alasan wajib diisi"),
});

/**
 * Unlocking = deleting the period_locks row (T-4 checks existence). The
 * reason is written to unlock_reason first so the audit trigger's
 * old_value on the DELETE captures it — otherwise there's no record of
 * *why* a period was reopened.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, appUser, supabase } = await getAuthedAppUser();

  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }
  if (!appUser || appUser.role !== "owner") {
    return NextResponse.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }

  const body = await request.json().catch(() => null);
  const parsed = unlockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(fail("VALIDATION_ERROR", "reason wajib diisi"), {
      status: httpStatus("VALIDATION_ERROR"),
    });
  }

  const { error: updateError } = await supabase
    .from("period_locks")
    .update({ unlock_reason: parsed.data.reason })
    .eq("id", id);

  if (updateError) {
    console.error("[api/period-locks/:id] DELETE (update reason)", updateError);
    return NextResponse.json(fail("INTERNAL_ERROR"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }

  const { error: deleteError, count } = await supabase
    .from("period_locks")
    .delete({ count: "exact" })
    .eq("id", id);

  if (deleteError) {
    console.error("[api/period-locks/:id] DELETE", deleteError);
    return NextResponse.json(fail("INTERNAL_ERROR"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }
  if (!count) {
    return NextResponse.json(fail("NOT_FOUND", "Period lock tidak ditemukan"), {
      status: httpStatus("NOT_FOUND"),
    });
  }

  return NextResponse.json(ok({ unlocked: true }));
}
