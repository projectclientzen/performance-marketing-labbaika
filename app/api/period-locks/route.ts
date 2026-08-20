import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedAppUser } from "@/lib/auth/session";
import { ok, fail, httpStatus } from "@/lib/api/envelope";

const lockSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});

export async function GET() {
  const { user, appUser, supabase } = await getAuthedAppUser();
  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }
  if (!appUser || appUser.role !== "owner") {
    return NextResponse.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }

  const { data, error } = await supabase
    .from("period_locks")
    .select("*")
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (error) {
    console.error("[api/period-locks]", error);
    return NextResponse.json(fail("INTERNAL_ERROR"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }
  return NextResponse.json(ok(data));
}

export async function POST(request: Request) {
  const { user, appUser, supabase } = await getAuthedAppUser();
  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }
  if (!appUser || appUser.role !== "owner") {
    return NextResponse.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }

  const body = await request.json().catch(() => null);
  const parsed = lockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(fail("VALIDATION_ERROR", "year dan month wajib diisi"), {
      status: httpStatus("VALIDATION_ERROR"),
    });
  }

  const { data, error } = await supabase
    .from("period_locks")
    .insert({ ...parsed.data, brand_id: appUser.brand_id, locked_by: appUser.id })
    .select()
    .single();

  if (error) {
    if (error.message.includes("duplicate key")) {
      return NextResponse.json(fail("CONFLICT", "Periode ini sudah dikunci"), {
        status: httpStatus("CONFLICT"),
      });
    }
    console.error("[api/period-locks]", error);
    return NextResponse.json(fail("INTERNAL_ERROR"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }
  return NextResponse.json(ok(data));
}
