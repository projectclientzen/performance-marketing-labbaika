import { NextResponse } from "next/server";
import { getAuthedAppUser } from "@/lib/auth/session";
import { hasOwnerAccess } from "@/lib/auth/roles";
import { ok, fail, httpStatus } from "@/lib/api/envelope";

/**
 * Menghapus satu keberangkatan. Id-nya ada di path, bukan query string —
 * versi pertama memakai `?id=` dan gagal di produksi dengan "Parameter id
 * wajib diisi", jadi bentuk ini dipakai karena tidak menyisakan ruang bagi
 * parameter untuk hilang di jalan.
 *
 * `program_id` dari path ikut jadi penyaring supaya id milik program lain
 * tidak bisa dihapus lewat rute ini.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; departureId: string }> },
) {
  const { id, departureId } = await params;
  const { user, appUser, supabase } = await getAuthedAppUser();

  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }
  if (!appUser || !hasOwnerAccess(appUser.role)) {
    return NextResponse.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }

  // closings menyimpan departure_id; menghapusnya membuat baris closing
  // menunjuk keberangkatan yang tidak ada lagi.
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
    console.error("[api/programs/:id/departures/:departureId] DELETE", error);
    return NextResponse.json(fail("INTERNAL_ERROR"), { status: httpStatus("INTERNAL_ERROR") });
  }
  if (!count) {
    return NextResponse.json(fail("NOT_FOUND", "Keberangkatan tidak ditemukan"), {
      status: httpStatus("NOT_FOUND"),
    });
  }

  return NextResponse.json(ok({ id: departureId }));
}
