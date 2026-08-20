import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedAppUser } from "@/lib/auth/session";
import { ok, fail, httpStatus } from "@/lib/api/envelope";

const patchSchema = z.object({
  default_margin_pct: z.number().min(0).max(100).optional(),
  auto_lock_days: z.number().int().positive().optional(),
});

export async function GET() {
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
    return NextResponse.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }

  const { data, error } = await supabase
    .from("brand_settings")
    .select("*")
    .eq("brand_id", appUser.brand_id)
    .maybeSingle();

  if (error) {
    console.error("[api/brand-settings]", error);
    return NextResponse.json(fail("INTERNAL_ERROR"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }
  return NextResponse.json(ok(data ?? { brand_id: appUser.brand_id, default_margin_pct: null, auto_lock_days: 45 }));
}

export async function PATCH(request: Request) {
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
    return NextResponse.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(fail("VALIDATION_ERROR", "default_margin_pct/auto_lock_days tidak valid"), {
      status: httpStatus("VALIDATION_ERROR"),
    });
  }

  const { data, error } = await supabase
    .from("brand_settings")
    .upsert({ brand_id: appUser.brand_id, ...parsed.data, updated_by: appUser.id })
    .select()
    .single();

  if (error) {
    console.error("[api/brand-settings]", error);
    return NextResponse.json(fail("INTERNAL_ERROR"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }
  return NextResponse.json(ok(data));
}
