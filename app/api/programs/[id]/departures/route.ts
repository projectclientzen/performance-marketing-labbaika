import { NextResponse } from "next/server";
import { getAuthedAppUser } from "@/lib/auth/session";
import { ok, fail, httpStatus } from "@/lib/api/envelope";
import { departureSchema } from "@/lib/schemas/program";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, supabase } = await getAuthedAppUser();
  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }

  const { data, error } = await supabase
    .from("program_departures")
    .select("*")
    .eq("program_id", id)
    .order("departure_date");

  if (error) {
    console.error("[api/programs/[id]/departures]", error);
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
  if (appUser.role !== "owner") {
    return NextResponse.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }

  const body = await request.json().catch(() => null);
  const parsed = departureSchema.safeParse({ ...body, program_id: id });
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[issue.path.join(".") || "body"] = issue.message;
    return NextResponse.json(fail("VALIDATION_ERROR", undefined, fields), {
      status: httpStatus("VALIDATION_ERROR"),
    });
  }

  const { data, error } = await supabase
    .from("program_departures")
    .insert({ ...parsed.data, brand_id: appUser.brand_id })
    .select()
    .single();

  if (error) {
    console.error("[api/programs/[id]/departures]", error);
    return NextResponse.json(fail("INTERNAL_ERROR"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }
  return NextResponse.json(ok(data));
}
