import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedAppUser } from "@/lib/auth/session";
import { hasOwnerAccess } from "@/lib/auth/roles";
import { ok, fail, httpStatus } from "@/lib/api/envelope";

/** Lead source = master data (Facebook, Google, dst). Owner-only kelola;
 *  RLS lead_sources_owner_all yang jadi batas sebenarnya. */
export async function GET() {
  const { user, appUser, supabase } = await getAuthedAppUser();
  if (!user) return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  if (!appUser || !hasOwnerAccess(appUser.role)) {
    return NextResponse.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }
  const { data, error } = await supabase
    .from("lead_sources")
    .select("id, name, slug, is_active, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    console.error("[api/lead-sources] GET", error);
    return NextResponse.json(fail("INTERNAL_ERROR"), { status: httpStatus("INTERNAL_ERROR") });
  }
  return NextResponse.json(ok(data));
}

const postSchema = z.object({ name: z.string().trim().min(1, "Nama wajib diisi") });

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "source";
}

export async function POST(request: Request) {
  const { user, appUser, supabase } = await getAuthedAppUser();
  if (!user) return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  if (!appUser || !hasOwnerAccess(appUser.role)) {
    return NextResponse.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }
  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(fail("VALIDATION_ERROR", parsed.error.issues[0]?.message), {
      status: httpStatus("VALIDATION_ERROR"),
    });
  }
  // brand_id dari sesi, tidak pernah dari request. RLS with-check menolak
  // brand lain seandainya nilai ini salah.
  const { data, error } = await supabase
    .from("lead_sources")
    .insert({ brand_id: appUser.brand_id, name: parsed.data.name, slug: slugify(parsed.data.name) })
    .select()
    .single();
  if (error) {
    console.error("[api/lead-sources] POST", error);
    const dup = /duplicate key|unique/i.test(error.message);
    return NextResponse.json(
      fail("VALIDATION_ERROR", dup ? "Sumber dengan nama serupa sudah ada" : "Gagal menambah sumber"),
      { status: httpStatus("VALIDATION_ERROR") },
    );
  }
  return NextResponse.json(ok(data));
}
