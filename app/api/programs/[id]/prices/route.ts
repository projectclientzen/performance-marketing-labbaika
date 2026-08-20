import { NextResponse } from "next/server";
import { getAuthedAppUser } from "@/lib/auth/session";
import { hasOwnerAccess } from "@/lib/auth/roles";
import { ok, fail, httpStatus } from "@/lib/api/envelope";
import { priceSchema } from "@/lib/schemas/program";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, supabase } = await getAuthedAppUser();
  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }

  const { data, error } = await supabase
    .from("program_prices")
    .select("*")
    .eq("program_id", id)
    .order("effective_date", { ascending: false });

  if (error) {
    console.error("[api/programs/[id]/prices]", error);
    return NextResponse.json(fail("INTERNAL_ERROR"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }
  return NextResponse.json(ok(data));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  if (!hasOwnerAccess(appUser.role)) {
    return NextResponse.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }

  const body = await request.json().catch(() => null);
  const parsed = priceSchema.safeParse({ ...body, program_id: id });
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[issue.path.join(".") || "body"] = issue.message;
    return NextResponse.json(fail("VALIDATION_ERROR", undefined, fields), {
      status: httpStatus("VALIDATION_ERROR"),
    });
  }

  const { data, error } = await supabase
    .from("program_prices")
    .insert({ ...parsed.data, brand_id: appUser.brand_id, created_by: appUser.id })
    .select()
    .single();

  if (error) {
    if (error.message.includes("program_prices_no_overlap")) {
      return NextResponse.json(
        fail("CONFLICT", "Periode harga ini bertumpuk dengan harga aktif lain untuk kombinasi yang sama"),
        { status: httpStatus("CONFLICT") },
      );
    }
    console.error("[api/programs/[id]/prices]", error);
    return NextResponse.json(fail("INTERNAL_ERROR"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }
  return NextResponse.json(ok(data));
}
