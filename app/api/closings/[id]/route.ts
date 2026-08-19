import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedAppUser } from "@/lib/auth/session";
import { ok, fail, httpStatus } from "@/lib/api/envelope";

// Explicit allow-list, not a passthrough of the request body: cost_at_transaction
// is a plain (non-generated) column with no BEFORE UPDATE trigger guarding it
// (T-7 only runs on INSERT — see migration 008), so forwarding arbitrary
// client fields here would let a cs PATCH their own HPP. cost_of_sales and
// gross_profit are `generated always as ... stored` and Postgres itself
// rejects writes to those regardless.
const patchSchema = z.object({
  last_name: z.string().optional(),
  email: z.string().email().optional(),
  payment_status: z.enum(["dp", "partial", "lunas", "refunded"]).optional(),
  paid_amount: z.number().int().nonnegative().optional(),
  price_note: z.string().optional(),
  province_id: z.string().optional(),
  city_id: z.string().optional(),
  address: z.string().optional(),
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

  const { data, error } = await supabase
    .from("closings")
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
    if (error.message.includes("closing_paid")) {
      return NextResponse.json(fail("VALIDATION_ERROR", "paid_amount melebihi total_value"), {
        status: httpStatus("VALIDATION_ERROR"),
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
