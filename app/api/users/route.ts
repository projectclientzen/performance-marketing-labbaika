import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedAppUser } from "@/lib/auth/session";
import { hasOwnerAccess } from "@/lib/auth/roles";
import { ok, fail, httpStatus } from "@/lib/api/envelope";

// Not in 04-BRIEF-BE.md's endpoint list explicitly, but F-19 (Manajemen
// user) needs somewhere to read/update roles from. Owner-only; creating
// new auth identities (POST) isn't included — that needs Supabase Admin
// API (service role), out of scope for this pass.

export async function GET() {
  const { user, appUser, supabase } = await getAuthedAppUser();
  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }
  if (!appUser || !hasOwnerAccess(appUser.role)) {
    return NextResponse.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }

  const { data, error } = await supabase
    .from("app_users")
    .select("id, full_name, role, is_active, created_at")
    .order("full_name");

  if (error) {
    console.error("[api/users]", error);
    return NextResponse.json(fail("INTERNAL_ERROR"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }
  return NextResponse.json(ok(data));
}

const patchSchema = z.object({
  role: z.enum(["owner", "advertiser", "cs"]).optional(),
  is_active: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const { user, appUser, supabase } = await getAuthedAppUser();
  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }
  if (!appUser || !hasOwnerAccess(appUser.role)) {
    return NextResponse.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }

  const body = await request.json().catch(() => null);
  const targetId = body?.id;
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success || !targetId) {
    return NextResponse.json(fail("VALIDATION_ERROR", "id dan field yang diubah wajib diisi"), {
      status: httpStatus("VALIDATION_ERROR"),
    });
  }

  const { data, error } = await supabase
    .from("app_users")
    .update(parsed.data)
    .eq("id", targetId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[api/users]", error);
    return NextResponse.json(fail("INTERNAL_ERROR"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }
  if (!data) {
    return NextResponse.json(fail("NOT_FOUND", "User tidak ditemukan"), {
      status: httpStatus("NOT_FOUND"),
    });
  }
  return NextResponse.json(ok(data));
}
