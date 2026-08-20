import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getAuthedAppUser } from "@/lib/auth/session";
import { hasOwnerAccess } from "@/lib/auth/roles";
import { ok, fail, httpStatus } from "@/lib/api/envelope";

// Same inline-only service-role pattern as app/api/users/route.ts — one
// caller, kept local rather than a shared module.
function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * 10-AUDIT-FE-BE.md #26: "Lupa password" on /login was a dead href="#" --
 * there's no SMTP configured and no self-serve reset page, so there was
 * genuinely nothing to link to. This gives the owner a way to hand a CS a
 * working reset path without either: same generateLink mechanism as the
 * invite flow (7e9ef99/8bf916d), type "recovery" instead of "invite". No
 * email is sent by Supabase; the link is returned once, in this response,
 * for the owner to relay however they already relay invites (WhatsApp).
 *
 * The target user's own row is only read via the caller's RLS-scoped
 * client (confirms they're in this owner's brand before anything touches
 * auth) -- the admin client is reached for exactly once, to resolve the
 * id to an email and generate the link. It never decides who's allowed to
 * request a reset for whom.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, appUser, supabase } = await getAuthedAppUser();
  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }
  if (!appUser || !hasOwnerAccess(appUser.role)) {
    return NextResponse.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }

  // RLS (app_users owner_all policy): confirms `id` is actually a user in
  // this owner's own brand before any admin call is made for them.
  const { data: target, error: targetError } = await supabase
    .from("app_users")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (targetError) {
    console.error("[api/users/[id]/reset-password]", targetError);
    return NextResponse.json(fail("INTERNAL_ERROR"), { status: httpStatus("INTERNAL_ERROR") });
  }
  if (!target) {
    return NextResponse.json(fail("NOT_FOUND", "User tidak ditemukan"), {
      status: httpStatus("NOT_FOUND"),
    });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(fail("INTERNAL_ERROR", "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }

  const { data: authUser, error: authError } = await admin.auth.admin.getUserById(id);
  if (authError || !authUser?.user?.email) {
    console.error("[api/users/[id]/reset-password] getUserById", authError);
    return NextResponse.json(fail("INTERNAL_ERROR", "Gagal membuat tautan reset"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: authUser.user.email,
  });
  if (linkError || !link.properties) {
    // Raw GoTrue message not forwarded to the client — same pattern as
    // every other route (07-AUDIT-REPO.md S1-04).
    console.error("[api/users/[id]/reset-password] generateLink", linkError);
    return NextResponse.json(fail("INTERNAL_ERROR", "Gagal membuat tautan reset"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }

  return NextResponse.json(ok({ reset_link: link.properties.action_link }));
}
