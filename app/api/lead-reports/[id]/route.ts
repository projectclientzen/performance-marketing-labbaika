import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedAppUser } from "@/lib/auth/session";
import { ok, fail, httpStatus } from "@/lib/api/envelope";

const patchSchema = z.object({
  cold: z.number().int().nonnegative().optional(),
  consultation: z.number().int().nonnegative().optional(),
  offering: z.number().int().nonnegative().optional(),
  total_lead: z.number().int().nonnegative().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join(".") || "body"] = issue.message;
    }
    return NextResponse.json(fail("VALIDATION_ERROR", undefined, fields), {
      status: httpStatus("VALIDATION_ERROR"),
    });
  }

  // RLS scopes this to the caller's own report (cs) or any report in their
  // brand (owner); the period-lock trigger (T-4) rejects a locked month for
  // non-owners with its own message, surfaced below.
  const { data, error } = await supabase
    .from("lead_reports")
    .update({ ...parsed.data, updated_by: appUser.id })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    if (error.message.includes("sudah dikunci")) {
      return NextResponse.json(fail("FORBIDDEN", error.message), {
        status: httpStatus("FORBIDDEN"),
      });
    }
    if (error.message.includes("lead_reports_sum_check")) {
      return NextResponse.json(
        fail("VALIDATION_ERROR", "Jumlah stage harus sama dengan total lead"),
        { status: httpStatus("VALIDATION_ERROR") },
      );
    }
    if (error.message.includes("tidak bisa diubah")) {
      return NextResponse.json(fail("VALIDATION_ERROR", error.message), {
        status: httpStatus("VALIDATION_ERROR"),
      });
    }
    return NextResponse.json(fail("INTERNAL_ERROR", error.message), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }

  if (!data) {
    return NextResponse.json(fail("NOT_FOUND", "Laporan tidak ditemukan"), {
      status: httpStatus("NOT_FOUND"),
    });
  }

  return NextResponse.json(ok(data));
}
