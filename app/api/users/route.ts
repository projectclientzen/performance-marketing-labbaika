import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getAuthedAppUser } from "@/lib/auth/session";
import { hasOwnerAccess } from "@/lib/auth/roles";
import { ok, fail, httpStatus } from "@/lib/api/envelope";
import { normalizePhoneID } from "@/lib/utils/phone";

// Not in 04-BRIEF-BE.md's endpoint list explicitly, but F-19 (Manajemen
// user) needs somewhere to read/update roles from.
//
// service role is used twice in this file (email lookup in GET, identity
// creation in POST) — kept as a local helper rather than a shared module.
// Same reasoning both times: one file, narrow use, no "bypass RLS" export
// sitting around for some other route to reach for without thinking about
// what it actually grants.
function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

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
    .select("id, full_name, whatsapp, role, is_active, created_at")
    .order("full_name");

  if (error) {
    console.error("[api/users]", error);
    return NextResponse.json(fail("INTERNAL_ERROR"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }

  const admin = createAdminClient();
  if (!admin) {
    console.error("[api/users] SUPABASE_SERVICE_ROLE_KEY belum diisi — email tidak ikut dikembalikan");
    return NextResponse.json(ok(data.map((u) => ({ ...u, email: null }))));
  }

  const withEmail = await Promise.all(
    data.map(async (u) => {
      const { data: authUser } = await admin.auth.admin.getUserById(u.id);
      return { ...u, email: authUser?.user?.email ?? null };
    }),
  );

  return NextResponse.json(ok(withEmail));
}

const postSchema = z.object({
  full_name: z.string().min(1, "Nama wajib diisi"),
  whatsapp: z.string().refine((v) => normalizePhoneID(v) !== null, {
    message: "Nomor WhatsApp Indonesia tidak valid",
  }),
  email: z.string().email("Email tidak valid"),
  role: z.enum(["owner", "advertiser", "cs"]).default("cs"),
  password: z
    .string()
    .min(8, "Password minimal 8 karakter"),
});

/**
 * 10-AUDIT-FE-BE.md #15: creating a CS/owner identity used to need the
 * Supabase dashboard directly. Sempat memakai generateLink({type:"invite"})
 * supaya user menetapkan passwordnya sendiri, tapi diganti atas permintaan
 * Maszen: owner mengetik password di form ini dan menyerahkannya langsung.
 * Alasannya operasional — merelai tautan undangan ke CS lewat WA ternyata
 * lebih ribet daripada menyebutkan password.
 *
 * Konsekuensi yang diterima secara sadar: password buatan owner bersifat
 * permanen dan diketahui owner, dan sampai ada UI ganti password, CS tidak
 * bisa menggantinya sendiri. Owner bisa menimpanya kapan saja lewat tombol
 * "Reset password" di layar yang sama.
 *
 * The app_users row (brand_id, role, whatsapp) is inserted through the
 * CALLER's own client, not the admin one, so RLS decides whether this
 * owner is allowed to add a user to their own brand. Service role here
 * only ever creates the login identity; it never gets to decide who
 * belongs to which brand — brand_id never comes from the request body.
 *
 * There's still no password-change/reset UI for a CS to use after their
 * first login — a real gap, not solved here since it wasn't asked for.
 */
export async function POST(request: Request) {
  const { user, appUser, supabase } = await getAuthedAppUser();
  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }
  if (!appUser || !hasOwnerAccess(appUser.role)) {
    return NextResponse.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(fail("INTERNAL_ERROR", "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }

  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join(".") || "body"] = issue.message;
    }
    return NextResponse.json(fail("VALIDATION_ERROR", undefined, fields), {
      status: httpStatus("VALIDATION_ERROR"),
    });
  }

  const whatsapp = normalizePhoneID(parsed.data.whatsapp);

  // Owner menetapkan password langsung (keputusan Maszen): tidak ada tautan
  // undangan yang perlu direlai, akun langsung bisa dipakai. email_confirm
  // true karena tidak ada SMTP — tanpa itu user tidak akan pernah bisa
  // memverifikasi alamatnya dan login akan ditolak.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    // Pesan mentah dari GoTrue tidak diteruskan ke klien — pola yang sama
    // dibersihkan dari seluruh route lain di 17edd27 dan 9a9d744
    // (07-AUDIT-REPO.md S1-04). Satu kondisi dipetakan khusus karena owner
    // memang perlu tahu bedanya: email yang sudah terpakai bisa dia perbaiki
    // sendiri, sisanya tidak.
    const sudahTerdaftar = /already been registered|already exists/i.test(createError?.message ?? "");
    console.error("[api/users] POST createUser", createError);
    return NextResponse.json(
      fail(
        "VALIDATION_ERROR",
        sudahTerdaftar ? "Email ini sudah terdaftar" : "Gagal membuat akun",
        sudahTerdaftar ? { email: "sudah terdaftar" } : undefined,
      ),
      { status: httpStatus("VALIDATION_ERROR") },
    );
  }

  // Through the caller's own client — RLS (app_users owner_all policy)
  // decides whether this owner may insert a row, and brand_id comes from
  // the caller's own session, not from anything in the request body.
  const { data: appUserRow, error: insertError } = await supabase
    .from("app_users")
    .insert({
      id: created.user.id,
      brand_id: appUser.brand_id,
      full_name: parsed.data.full_name,
      whatsapp,
      role: parsed.data.role,
    })
    .select()
    .single();

  if (insertError) {
    console.error("[api/users] POST app_users insert", insertError);
    // Auth identity exists but the app_users row failed — clean up rather
    // than leave an orphaned login with no profile.
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json(fail("INTERNAL_ERROR", "Gagal menyimpan profil user"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }

  // Password tidak dikembalikan — owner sudah mengetiknya sendiri, jadi tidak
  // perlu dipantulkan balik lewat response.
  return NextResponse.json(ok({ ...appUserRow, email: parsed.data.email }));
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
