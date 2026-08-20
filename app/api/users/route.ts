import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
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

  // RLS on app_users (owner_all policy) is what decides which users this
  // caller may see — that's step 1, through the caller's own anon-key
  // client, unchanged from before. email lives in auth.users, which
  // PostgREST doesn't expose, so step 2 fills it in per already-visible
  // row via the admin API. Scope stays with RLS; the service role never
  // decides who's in the list, only supplies one column for ids that
  // already passed. This key is server-only — never NEXT_PUBLIC_, never
  // imported by a client component. First use of it in this app, so
  // keeping it inline here rather than a shared module: one caller, no
  // reusable "bypass RLS" export sitting around for the next route to
  // reach for without thinking.
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

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error("[api/users] SUPABASE_SERVICE_ROLE_KEY belum diisi — email tidak ikut dikembalikan");
    return NextResponse.json(ok(data.map((u) => ({ ...u, email: null }))));
  }
  const admin = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const withEmail = await Promise.all(
    data.map(async (u) => {
      const { data: authUser } = await admin.auth.admin.getUserById(u.id);
      return { ...u, email: authUser?.user?.email ?? null };
    }),
  );

  return NextResponse.json(ok(withEmail));
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
