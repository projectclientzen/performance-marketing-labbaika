import { NextResponse } from "next/server";
import { getAuthedAppUser } from "@/lib/auth/session";
import { ok, fail, httpStatus } from "@/lib/api/envelope";

/**
 * Menghapus satu baris harga. Id di path, sama alasannya dengan rute
 * keberangkatan di sebelah.
 *
 * Tidak ada pengecekan pemakaian: closing menyimpan `price_at_transaction`
 * sebagai angka di barisnya sendiri, bukan rujukan ke tabel harga — jadi
 * menghapus harga tidak pernah mengubah closing yang sudah tercatat.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; priceId: string }> },
) {
  const { id, priceId } = await params;
  const { user, appUser, supabase } = await getAuthedAppUser();

  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }
  if (!appUser) {
    return NextResponse.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }

  const { error, count } = await supabase
    .from("program_prices")
    .delete({ count: "exact" })
    .eq("id", priceId)
    .eq("program_id", id);

  if (error) {
    console.error("[api/programs/:id/prices/:priceId] DELETE", error);
    return NextResponse.json(fail("INTERNAL_ERROR"), { status: httpStatus("INTERNAL_ERROR") });
  }
  if (!count) {
    return NextResponse.json(fail("NOT_FOUND", "Harga tidak ditemukan"), {
      status: httpStatus("NOT_FOUND"),
    });
  }

  return NextResponse.json(ok({ id: priceId }));
}
