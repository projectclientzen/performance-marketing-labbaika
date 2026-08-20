import { NextResponse } from "next/server";
import { getAuthedAppUser } from "@/lib/auth/session";
import { hasOwnerAccess } from "@/lib/auth/roles";
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
  if (!hasOwnerAccess(appUser.role)) {
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

/**
 * Menghapus satu keberangkatan. `?id=` menunjuk barisnya; program di path
 * dipakai sebagai penyaring kedua supaya id dari program lain tidak bisa
 * dihapus lewat rute ini.
 *
 * Keberangkatan yang sudah dipakai closing ditolak — closing menyimpan
 * departure_id, dan menghapusnya membuat baris closing menunjuk keberangkatan
 * yang tidak ada.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, appUser, supabase } = await getAuthedAppUser();

  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }
  if (!appUser || !hasOwnerAccess(appUser.role)) {
    return NextResponse.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }

  const departureId = new URL(request.url).searchParams.get("id");
  if (!departureId) {
    return NextResponse.json(fail("BAD_REQUEST", "Parameter id wajib diisi"), {
      status: httpStatus("BAD_REQUEST"),
    });
  }

  const { count: dipakai } = await supabase
    .from("closings")
    .select("id", { count: "exact", head: true })
    .eq("departure_id", departureId);

  if (dipakai) {
    return NextResponse.json(
      fail("CONFLICT", `Keberangkatan ini dipakai ${dipakai} closing, jadi tidak bisa dihapus.`),
      { status: httpStatus("CONFLICT") },
    );
  }

  const { error, count } = await supabase
    .from("program_departures")
    .delete({ count: "exact" })
    .eq("id", departureId)
    .eq("program_id", id);

  if (error) {
    console.error("[api/programs/:id/departures] DELETE", error);
    return NextResponse.json(fail("INTERNAL_ERROR"), { status: httpStatus("INTERNAL_ERROR") });
  }
  if (!count) {
    return NextResponse.json(fail("NOT_FOUND", "Keberangkatan tidak ditemukan"), {
      status: httpStatus("NOT_FOUND"),
    });
  }

  return NextResponse.json(ok({ id: departureId }));
}
